'use babel';
/** @jsx etch.dom */

import {Emitter, CompositeDisposable, Disposable} from 'atom';
import etch from 'etch';
import BSMap from './map';


export default class MapEditorView {
	constructor (editor) {
		this.editor = editor;
		this.emitter = new Emitter();
		this.disposables = new CompositeDisposable();
		this.loaded = false;
		etch.initialize(this);
		this.drawbind = this.draw.bind(this);
		requestAnimationFrame(this.drawbind);
		this.mapwindow_zoom = 1;
		this.mapwindow_log_zoom = 1;
		this.mapwindow_x = 0;
		this.mapwindow_y = 0;
		this.mouse_tile_x = undefined;
		this.mouse_tile_y = undefined;

		this.disposables.add(atom.commands.add(this.element, {
		}));
		this.disposables.add(new Disposable(()=>{cancelAnimationFrame(this.drawbind);}));
		this.canvas_mousedown = this.canvas_mousedown.bind(this);
		this.refs.mapcanvas.addEventListener("mousedown", this.canvas_mousedown);
		this.disposables.add(new Disposable(()=>{this.refs.mapcanvas.removeEventListener("mousedown", this.canvas_mousedown);}));
		this.canvas_wheel = this.canvas_wheel.bind(this);
		this.refs.mapcanvas.addEventListener("wheel", this.canvas_wheel);
		this.disposables.add(new Disposable(()=>{this.refs.mapcanvas.removeEventListener("wheel", this.canvas_wheel);}));
		this.canvas_mousemove = this.canvas_mousemove.bind(this);
		this.refs.mapcanvas.addEventListener("mousemove", this.canvas_mousemove);
		this.disposables.add(new Disposable(()=>{this.refs.mapcanvas.removeEventListener("mousemove", this.canvas_mousemove);}));
		this.canvas_mouseout = this.canvas_mouseout.bind(this);
		this.refs.mapcanvas.addEventListener("mouseout", this.canvas_mouseout);
		this.disposables.add(new Disposable(()=>{this.refs.mapcanvas.removeEventListener("mouseout", this.canvas_mouseout);}));
	}

	onDidLoad (callback) {
		return this.emitter.on('did-load', callback);
	}

	update () {return etch.update(this)}

	draw(timestamp) {
		var canvas = this.refs.mapcanvas;
		// Make the canvas have 1:1 pixels
		canvas.width = Math.round(canvas.clientWidth * devicePixelRatio);
		canvas.height = Math.round(canvas.clientHeight * devicePixelRatio);
		var ctx = canvas.getContext('2d');
		ctx.clearRect(0,0,canvas.width,canvas.height);
		ctx.save();
		ctx.translate(Math.round(canvas.width/2), Math.round(canvas.height/2));
		ctx.scale(this.mapwindow_zoom, this.mapwindow_zoom);
		ctx.translate(Math.round(this.mapwindow_x*32*this.mapwindow_zoom)/this.mapwindow_zoom, -Math.round(this.mapwindow_y*32*this.mapwindow_zoom)/this.mapwindow_zoom);
		ctx.imageSmoothingEnabled = false;
		if(this.editor.map) {
			if(this.editor.map.needs_sort)
				this.editor.map.sort_objects();
			for(var obj of this.editor.map.objects) {
				if(!obj.appearance_controller) continue;
				obj.appearance_controller.on_render_tick(timestamp);
				ctx.save();
				ctx.translate(obj.x*32, -obj.y*32);
				obj.appearance_controller.draw(ctx, timestamp);
				ctx.restore();
			}
		}
		if(this.mouse_tile_x !== undefined && this.mouse_tile_y !== undefined) {
			ctx.strokeStyle = "#ffffff";
			ctx.strokeRect(Math.floor(this.mouse_tile_x)*32+0.5, -Math.floor(this.mouse_tile_y)*32+0.5, 31, 31);
			ctx.strokeStyle = "#000000";
			ctx.globalAlpha = 0.5;
			ctx.strokeRect(Math.floor(this.mouse_tile_x)*32+1.5, -Math.floor(this.mouse_tile_y)*32+1.5, 29, 29);
			ctx.globalAlpha = 1;
		}
		ctx.restore();
		requestAnimationFrame(this.drawbind);
	}

	canvas_mousedown(e) {
		this.update_mouse_tile(e);
		// Middle click or alt left click
		// alt-right clicking causes instant purging.
		if(e.button == 1 || (e.button == 0 && e.altKey && !e.ctrlKey && !e.shiftKey)) {
			var mouse_disposable;
			var lastE = e;
			var mouseup = (e) => {
				mouse_disposable.dispose();
				this.disposables.remove(mouse_disposable);
			}
			var mousemove = (e) => {
				this.mapwindow_x += (e.screenX - lastE.screenX) / 32 / this.mapwindow_zoom * devicePixelRatio;
				this.mapwindow_y -= (e.screenY - lastE.screenY) / 32 / this.mapwindow_zoom * devicePixelRatio;
				lastE = e;
			}
			document.addEventListener("mouseup", mouseup);
			document.addEventListener("mousemove", mousemove);
			mouse_disposable = new Disposable(()=>{
				document.removeEventListener("mouseup", mouseup);
				document.removeEventListener("mousemove", mousemove);
			});
			this.disposables.add(mouse_disposable);
			e.preventDefault();
		} else if(e.button == 0) {
			var template_name = this.editor.getActiveTemplateName();
			if(template_name) {

				var inst = new BSMap.Instance(this.editor.map, {template_name, variant_leaf_path: this.editor.getActiveVariantPath(), x:Math.floor(this.mouse_tile_x), y:Math.floor(this.mouse_tile_y)});
				inst.finalize_movement();
				this.editor.emitter.emit("did-change");
				this.editor.map.modified = true;
				this.editor.emitter.emit("did-change-modified");
			}
		}
	}
	canvas_mousemove(e) {
		this.update_mouse_tile(e);
	}

	update_mouse_tile(e) {
		this.mouse_tile_x = (e.offsetX*devicePixelRatio - (this.refs.mapcanvas.width / 2)) / this.mapwindow_zoom/32 - this.mapwindow_x;
		this.mouse_tile_y = -(e.offsetY*devicePixelRatio - (this.refs.mapcanvas.height / 2)) / this.mapwindow_zoom/32 - this.mapwindow_y + 1;
		if(this.editor.context.status_view_attached)
			this.editor.context.status_view_attached.updateCoordinates();
	}

	canvas_mouseout(e) {
		this.mouse_tile_x = undefined;
		this.mouse_tile_y = undefined;
	}

	canvas_wheel(e) {
		this.mapwindow_log_zoom -= Math.max(-1, Math.min(1, e.deltaY / 100));
		this.mapwindow_log_zoom = Math.max(-5, Math.min(5, this.mapwindow_log_zoom))
		this.mapwindow_zoom = 2 ** Math.round(this.mapwindow_log_zoom);
		e.preventDefault();
		this.canvas_mousemove(e);
	}

	destroy () {
		this.disposables.dispose();
		this.emitter.dispose();
		return etch.destroy(this);
	}

	render () {
		return (
			<div className='map-editor' tabIndex='-1'>
				<canvas ref="mapcanvas" className="mapcanvas"></canvas>
			</div>
		);
	}
}
