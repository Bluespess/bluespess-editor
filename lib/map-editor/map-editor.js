'use babel';

import path from 'path';
import fs from 'fs-plus';
import {Emitter, File, CompositeDisposable} from 'atom';
import MapEditorView from './map-editor-view';
import BSMap from './map';

export default class MapEditor {
	constructor(filepath, context) {
		this.file = new File(filepath);
		this.context = context;
		this.subscriptions = new CompositeDisposable();
		this.map = new BSMap(context);
		this.map.load(filepath);
		this.emitter = new Emitter();

		this.reloaded_env = this.reloaded_env.bind(this);
		this.subscriptions.add(context.onReloadedEnv(this.reloaded_env));
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
		return this.view.element;
	}

	get view () {
		if (!this.editorView) {
			this.editorView = new MapEditorView(this);
		}
		return this.editorView;
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
		this.subscriptions.add(changeSubscription);
		return changeSubscription;
	}

	onDidChangeTitle(callback) {
		const renameSubscription = this.file.onDidRename(callback);
		this.subscriptions.add(renameSubscription);
		return renameSubscription;
	}

	onDidChangeModified(callback) {
		const changeSubscription = this.emitter.on("did-change-modified", callback);
		this.subscriptions.add(changeSubscription);
		return changeSubscription;
	}

	destroy() {
		this.subscriptions.dispose();
		if (this.view) {
			this.view.destroy();
		}
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
		for(var obj of this.map.objects) {
			obj.update_context();
		}
		for(var obj of this.map.objects) {
			obj.finalize_movement();
		}
	}

	async save() {
		await this.map.save(this.getPath());
		this.emitter.emit("did-change-modified");
	}
}
