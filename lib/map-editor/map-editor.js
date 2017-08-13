'use babel';

import path from 'path';
import fs from 'fs-plus';
import {Emitter, File, CompositeDisposable} from 'atom';

export default class MapEditor {
	constructor(filepath, context) {
		this.file = new File(filepath);
		this.context = context;
		this.subscriptions = new CompositeDisposable();
	}
	
	getTitle () {
		const filePath = this.getPath();
		if (filePath) {
			return path.basename(filePath);
		} else {
			return 'untitled';
		}
	}
	
	get element () {
		return this.view && this.view.element || document.createElement('div');
	}

	get view () {
		/*if (!this.editorView) {
			this.editorView = new MapEditorView(this);
		}*/
		return this.editorView;
	}
	
	getPath() {
		return this.file.getPath();
	}
	getURI() {
		return this.file.getPath();
	}
	
	terminatePendingState () {
		if (this.isEqual(atom.workspace.getCenter().getActivePane().getPendingItem())) {
			this.emitter.emit('did-terminate-pending-state');
		}
	}

	onDidTerminatePendingState (callback) {
		return this.emitter.on('did-terminate-pending-state', callback);
	}

	// Register a callback for when the image file changes
	onDidChange (callback) {
		const changeSubscription = this.file.onDidChange(callback);
		this.subscriptions.add(changeSubscription);
		return changeSubscription;
	}

	// Register a callback for whne the image's title changes
	onDidChangeTitle (callback) {
		const renameSubscription = this.file.onDidRename(callback);
		this.subscriptions.add(renameSubscription);
		return renameSubscription;
	}

	destroy () {
		this.subscriptions.dispose();
		if (this.view) {
			this.view.destroy();
		}
	}

	getAllowedLocations () {
		return ['center'];
	}
}