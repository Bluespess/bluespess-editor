'use babel'

import path from 'path';
import fs from 'fs-plus';
import {Emitter, File, CompositeDisposable} from 'atom';
import IconStateEditorView from './icon-state-editor-view';

// Editor model for an image file
export default class IconStateEditor {
	static deserialize ({filePath, metaFilePath}) {
		if (fs.isFileSync(filePath) && fs.isFileSync(metaFilePath)) {
			return new IconStateEditor(filePath, metaFilePath);
		} else {
			console.warn(`Could not deserialize image editor for path '${filePath}' because that file no longer exists`);
		}
	}

	constructor (filePath, metaFilePath) {
		this.file = new File(filePath);
		this.metaFile = new File(metaFilePath);
		this.subscriptions = new CompositeDisposable();
		this.emitter = new Emitter();
		this.updateMetaFile();
	}

	updateMetaFile() {
		fs.readFile(this.metaFile.getPath(), (err, data) => {
			if(err) throw err;
			this.iconMeta = JSON.parse(data);
			if(this.editorView)
				this.editorView.metaFileChanged();
		})
	}

	get element () {
		return this.view.element;
	}

	get view () {
		if (!this.editorView) {
			this.editorView = new IconStateEditorView(this);
		}
		return this.editorView;
	}

	serialize () {
		return {filePath: this.getPath(), deserializer: this.constructor.name, metaFilePath: this.metaFile.getPath()};
	}

	terminatePendingState () {
		if (this.isEqual(atom.workspace.getActivePane().getPendingItem())) {
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

	onMetaDidChange(callback) {
		const changeSubscription = this.metaFile.onDidChange(callback);
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
		if (this.editorView) {
			this.editorView.destroy();
		}
	}

	// Retrieves the filename of the open file.
	//
	// This is `'untitled'` if the file is new and not saved to the disk.
	//
	// Returns a {String}.
	getTitle () {
		const filePath = this.getPath();
		if (filePath) {
			return path.basename(filePath);
		} else {
			return 'untitled';
		}
	}

	// Retrieves the absolute path to the image.
	//
	// Returns a {String} path.
	getPath () {
		return this.file.getPath();
	}

	// Retrieves the URI of the image.
	//
	// Returns a {String}.
	getURI () {
		return this.getPath();
	}

	// Retrieves the encoded URI of the image.
	//
	// Returns a {String}.
	getEncodedURI () {
		return `file://${encodeURI(this.getPath().replace(/\\/g, '/')).replace(/#/g, '%23').replace(/\?/g, '%3F')}`;
	}

	// Compares two {IconStateEditor}s to determine equality.
	//
	// Equality is based on the condition that the two URIs are the same.
	//
	// Returns a {Boolean}.
	isEqual (other) {
		return other instanceof IconStateEditor && (this.getURI() === other.getURI());
	}

	// Essential: Invoke the given callback when the editor is destroyed.
	//
	// * `callback` {Function} to be called when the editor is destroyed.
	//
	// Returns a {Disposable} on which `.dispose()` can be called to unsubscribe.
	onDidDestroy (callback) {
		return this.emitter.on('did-destroy', callback);
	}
}
