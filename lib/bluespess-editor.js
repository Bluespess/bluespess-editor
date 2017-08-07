'use babel';

import fs from 'fs-plus';
import path from 'path';
import IconStateEditor from './icon-state-editor';
import {CompositeDisposable} from 'atom';

export default {
	bluespessEditorView: null,
	modalPanel: null,
	subscriptions: null,
	activate() {

		// Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
		this.subscriptions = new CompositeDisposable();

		this.subscriptions.add(atom.workspace.addOpener(openURI));
	},

	deactivate() {
		this.subscriptions.dispose();
	},

	deserialize(state) {
		return IconStateEditor.deserialize(state);
	}
};

function openURI(uri) {
	var extname = path.extname(uri);
	if(extname == ".png") {
		var parsed = path.parse(uri);
		parsed.base += ".json";
		var metauri = path.format(parsed);
		if(!fs.existsSync(metauri))
			return;
		return new IconStateEditor(uri, metauri);
	}
}
