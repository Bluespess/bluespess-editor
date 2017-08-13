'use babel';

import fs from 'fs-plus';
import path from 'path';
import IconStateEditor from './icon-state-editor/icon-state-editor';
import MapEditor from './map-editor/map-editor';
import {CompositeDisposable} from 'atom';

export default {
	bluespessEditorView: null,
	modalPanel: null,
	subscriptions: null,
	server_env: null,
	client_env: null,
	activate() {
		// Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
		this.subscriptions = new CompositeDisposable();
		
		this.subscriptions.add(atom.commands.add('atom-workspace', {
			'bluespess-editor:reload-env': this.reload_env.bind(this)
		}));
		
		this.subscriptions.add(atom.workspace.addOpener(this.openURI.bind(this)));
	},

	deactivate() {
		this.subscriptions.dispose();
	},

	deserialize(state) {
		return IconStateEditor.deserialize(state);
	},
	
	reload_env() {
		var root_dir = atom.workspace.project.rootDirectories[0].path
		var envfile_path = path.join(root_dir,".bs-env.json");
		if(!fs.existsSync(envfile_path))
			throw new Error("Environment file does not exist! You must create a .bs-env.json file.");
		var env_paths = JSON.parse(fs.readFileSync(envfile_path, "utf8"));
		global.is_bs_editor_env = true; // This flag will cause the environments to return their object instead of starting server/client
		// compile a list of all the require cache keys
		var keep_keys = new Set(Object.keys(require.cache));
		// Load the environments
		this.server_env = require(path.join(root_dir,env_paths.server_env_path));
		this.client_env = require(path.join(root_dir,env_paths.client_env_path));
		// Delete any new keys in the require cache so that we can do this again later if necessary
		for(var key of Object.keys(require.cache)) {
			if(!keep_keys.has(key)) {
				delete require.cache[key];
			}
		}
		console.log(this);
	},
	
	openURI(uri) {
		var extname = path.extname(uri);
		if(extname == ".png") {
			var parsed = path.parse(uri);
			parsed.base += ".json";
			var metauri = path.format(parsed);
			if(!fs.existsSync(metauri))
				return;
			return new IconStateEditor(uri, metauri);
		}
		if(extname == ".bsmap") {
			if(!this.server_env)
				this.reload_env();
			return new MapEditor(uri, this);
		}
	}
};