'use babel';

import {CompositeDisposable} from 'atom';
import MapEditor from './map-editor';

export default class MapEditorStatusView {
	constructor(statusBar) {
		this.statusBar = statusBar;
		this.disposables = new CompositeDisposable();

		this.element = document.createElement('div');
		this.element.classList.add('inline-block');

		this.current_coordinates = document.createElement('span');
		this.element.appendChild(this.current_coordinates);

		this.attach();

		this.disposables.add(atom.workspace.getCenter().onDidChangeActivePaneItem(() => {this.updateAll();}));
	}

	attach() {
		this.statusBarTile = this.statusBar.addLeftTile({item: this});
		this.updateAll();
	}
	destroy() {
		this.statusBarTile.destroy();
		thi.disposables.dispose();
	}

	updateAll() {
		const editor = atom.workspace.getCenter().getActivePaneItem();
		if(editor instanceof MapEditor) {
			this.element.style.display = '';
			this.updateCoordinates();
		} else {
			this.element.style.display = 'none';
		}
	}
	updateCoordinates() {
		const editor = atom.workspace.getCenter().getActivePaneItem();
		if(editor instanceof MapEditor) {
			if(editor.view.mouse_tile_x != undefined && editor.view.mouse_tile_y != undefined) {
				this.current_coordinates.innerText = `(${Math.floor(editor.view.mouse_tile_x)},${Math.floor(editor.view.mouse_tile_y)})`;
				this.current_coordinates.style.display = '';
			} else {
				this.current_coordinates.style.display = 'none';
			}
		}
	}
}
