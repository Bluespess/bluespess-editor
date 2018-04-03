'use strict';

const path = require('path');
const {Emitter, File, CompositeDisposable, Disposable} = require('atom');
const BSMap = require('./map');
const electron = require('electron');

var act_num = 0;

class MapEditor {
	constructor(filepath, context) {
		this.file = new File(filepath);
		this.context = context;
		this.disposables = new CompositeDisposable();
		this.map = new BSMap(context);
		this.map.load(filepath);
		this.emitter = new Emitter();

		this.reloaded_env = this.reloaded_env.bind(this);
		this.disposables.add(context.onReloadedEnv(this.reloaded_env));
		this.loaded = false;
		this.draw = this.draw.bind(this);
		this.frame_request = requestAnimationFrame(this.draw);
		this.mapwindow_zoom = 1;
		this.mapwindow_log_zoom = 1;
		this.mapwindow_x = 0;
		this.mapwindow_y = 0;
		this.mouse_tile_x = undefined;
		this.mouse_tile_y = undefined;

		this.element = document.createElement('div');
		this.element.classList.add('map-editor');
		this.mapcanvas = document.createElement('canvas');
		this.mapcanvas.classList.add('mapcanvas');
		this.element.appendChild(this.mapcanvas);

		this.disposables.add(atom.commands.add(this.element, {
		}));

		this.disposables.add(new Disposable(()=>{cancelAnimationFrame(this.frame_request);}));

		this.canvas_mousedown = this.canvas_mousedown.bind(this);
		this.mapcanvas.addEventListener("mousedown", this.canvas_mousedown);
		this.disposables.add(new Disposable(()=>{this.mapcanvas.removeEventListener("mousedown", this.canvas_mousedown);}));

		this.canvas_wheel = this.canvas_wheel.bind(this);
		this.mapcanvas.addEventListener("wheel", this.canvas_wheel);
		this.disposables.add(new Disposable(()=>{this.mapcanvas.removeEventListener("wheel", this.canvas_wheel);}));

		this.canvas_mousemove = this.canvas_mousemove.bind(this);
		this.mapcanvas.addEventListener("mousemove", this.canvas_mousemove);
		this.disposables.add(new Disposable(()=>{this.mapcanvas.removeEventListener("mousemove", this.canvas_mousemove);}));

		this.canvas_mouseout = this.canvas_mouseout.bind(this);
		this.mapcanvas.addEventListener("mouseout", this.canvas_mouseout);
		this.disposables.add(new Disposable(()=>{this.mapcanvas.removeEventListener("mouseout", this.canvas_mouseout);}));

		this.canvas_contextmenu = this.canvas_contextmenu.bind(this);
		this.mapcanvas.addEventListener("contextmenu", this.canvas_contextmenu);
		this.disposables.add(new Disposable(()=>{this.mapcanvas.removeEventListener("contextmenu", this.canvas_contextmenu);}));

		this.contextmenu_disposable = null;
		this.contextmenu_actions_disposable = null;
	}

	onDidLoad (callback) {
		return this.emitter.on('did-load', callback);
	}

	draw(timestamp) {
		var canvas = this.mapcanvas;
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
		if(this.map) {
			if(this.map.needs_sort)
				this.map.sort_objects();
			for(var obj of this.map.objects) {
				if(!obj.client_atom) continue;
				obj.client_atom.on_render_tick(timestamp);
				ctx.save();
				ctx.translate(obj.x*32, -obj.y*32);
				obj.client_atom.draw(ctx, timestamp);
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
		this.frame_request = requestAnimationFrame(this.draw);
	}

	canvas_mousedown(e) {
		this.update_mouse_tile(e);
		// Middle click or alt left click
		// alt-right clicking causes instant purging.
		if(e.button == 1 || (e.button == 0 && e.altKey && !e.ctrlKey && !e.shiftKey)) {
			var mouse_disposable;
			var lastE = e;
			var mouseup = () => {
				mouse_disposable.dispose();
				this.disposables.remove(mouse_disposable);
			};
			var mousemove = (e) => {
				this.mapwindow_x += (e.screenX - lastE.screenX) / 32 / this.mapwindow_zoom * devicePixelRatio;
				this.mapwindow_y -= (e.screenY - lastE.screenY) / 32 / this.mapwindow_zoom * devicePixelRatio;
				lastE = e;
			};
			document.addEventListener("mouseup", mouseup);
			document.addEventListener("mousemove", mousemove);
			mouse_disposable = new Disposable(()=>{
				document.removeEventListener("mouseup", mouseup);
				document.removeEventListener("mousemove", mousemove);
			});
			this.disposables.add(mouse_disposable);
			e.preventDefault();
		} else if(e.button == 0) {
			var template_name = this.getActiveTemplateName();
			if(template_name) {

				var inst = new BSMap.Instance(this.map, {template_name, variant_leaf_path: this.getActiveVariantPath(), x:Math.floor(this.mouse_tile_x), y:Math.floor(this.mouse_tile_y)});
				inst.finalize_movement();
				this.emitter.emit("did-change");
				this.map.modified = true;
				this.emitter.emit("did-change-modified");
			}
		}
	}
	canvas_mousemove(e) {
		this.update_mouse_tile(e);
	}

	canvas_contextmenu(e) {
		this.update_mouse_tile(e);
		if(this.contextmenu_disposable)
			this.contextmenu_disposable.dispose();
		if(this.contextmenu_actions_disposable)
			this.contextmenu_actions_disposable.dispose();
		var num = 0;
		var menu_items = [];
		var actions = {};
		var tile = this.map.grid[`${Math.floor(this.mouse_tile_x)},${Math.floor(this.mouse_tile_y)}`];
		if(!tile)
			return;
		for(let i = tile.length - 1; i >= 0; i--) {
			let item = tile[i];
			var icon = item.thumbnail ? electron.remote.nativeImage.createFromDataURL(item.thumbnail.data) : null;
			let menu_item = {label: `${item.computed_vars.name} (${item.template_name})${Array(++num).join(" ")}`, icon};
			let item_actions = this.get_actions(item);
			for(let action of item_actions) {
				let act_id = `bluespess:contextmenu-action-${++act_num}`;
				actions[act_id] = action.click.bind(action);
				action.command = act_id;
			}
			menu_item.submenu = item_actions;
			menu_items.push(menu_item);
		}
		menu_items.push({type:"separator"});
		this.contextmenu_disposable = atom.contextMenu.add({".mapcanvas": menu_items});
		this.contextmenu_actions_disposable = atom.commands.add('atom-workspace', actions);
	}

	get_actions(item) {
		var actions = [
			{
				label: "Delete",
				click: () => {
					item.del();
					this.emitter.emit("did-change");
					this.map.modified = true;
					this.emitter.emit("did-change-modified");
				}
			}
		];
		return actions;
	}

	update_mouse_tile(e) {
		this.mouse_tile_x = (e.offsetX*devicePixelRatio - (this.mapcanvas.width / 2)) / this.mapwindow_zoom/32 - this.mapwindow_x;
		this.mouse_tile_y = -(e.offsetY*devicePixelRatio - (this.mapcanvas.height / 2)) / this.mapwindow_zoom/32 - this.mapwindow_y + 1;
		if(this.context.status_view_attached)
			this.context.status_view_attached.updateCoordinates();
	}

	canvas_mouseout() {
		this.mouse_tile_x = undefined;
		this.mouse_tile_y = undefined;
	}

	canvas_wheel(e) {
		this.mapwindow_log_zoom -= Math.max(-1, Math.min(1, e.deltaY / 100));
		this.mapwindow_log_zoom = Math.max(-5, Math.min(5, this.mapwindow_log_zoom));
		this.mapwindow_zoom = 2 ** Math.round(this.mapwindow_log_zoom);
		e.preventDefault();
		this.canvas_mousemove(e);
	}

	destroy () {
		this.disposables.dispose();
		this.emitter.dispose();
		if(this.contextmenu_disposable)
			this.contextmenu_disposable.dispose();
		if(this.contextmenu_actions_disposable)
			this.contextmenu_actions_disposable.dispose();
	}

	getTitle () {
		const filePath = this.getPath();
		if (filePath) {
			return path.basename(filePath);
		} else {
			return 'untitled';
		}
	}

	getPath() {
		return this.file.getPath();
	}
	getURI() {
		return this.file.getPath();
	}

	terminatePendingState() {
		if (this.isEqual(atom.workspace.getCenter().getActivePane().getPendingItem())) {
			this.emitter.emit('did-terminate-pending-state');
		}
	}

	onDidTerminatePendingState(callback) {
		return this.emitter.on('did-terminate-pending-state', callback);
	}

	onDidChange(callback) {
		const changeSubscription = this.emitter.on("did-change", callback);
		this.disposables.add(changeSubscription);
		return changeSubscription;
	}

	onDidChangeTitle(callback) {
		const renameSubscription = this.file.onDidRename(callback);
		this.disposables.add(renameSubscription);
		return renameSubscription;
	}

	onDidChangeModified(callback) {
		const changeSubscription = this.emitter.on("did-change-modified", callback);
		this.disposables.add(changeSubscription);
		return changeSubscription;
	}

	getAllowedLocations() {
		return ['center'];
	}

	isModified() {
		return this.map.modified;
	}

	shouldPromptToSave() {
		return this.map.modified;
	}

	getActiveTemplateName() {
		return this.context.object_tree_view && this.context.object_tree_view.selected && this.context.object_tree_view.selected.template_name;
	}

	getActiveVariantPath() {
		return this.context.variant_view && this.context.variant_view.selected;
	}

	reloaded_env() {
		for(let obj of this.map.objects) {
			obj.update_context();
		}
		for(let obj of this.map.objects) {
			obj.finalize_movement();
		}
	}

	async save() {
		await this.map.save(this.getPath());
		this.emitter.emit("did-change-modified");
	}
}

module.exports = MapEditor;
