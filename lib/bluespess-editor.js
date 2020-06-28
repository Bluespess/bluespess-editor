'use strict';

const fs = require('fs-plus');
const path = require('path');
const IconStateEditor = require('./icon-state-editor/icon-state-editor');
const MapEditor = require('./map-editor/map-editor');
const MapEditorStatusView = require('./map-editor/map-editor-status-view');
const BSMap = require('./map-editor/map');
const ObjectTreeView = require('./map-editor/object-tree-view');
const VariantView = require('./map-editor/variant-view');
const {CompositeDisposable, Emitter} = require('atom');

module.exports = {
	subscriptions: null,
	server_env: null,
	client_env: null,
	object_tree_view: null,
	status_bar: null,
	status_view_attached: null,
	activate() {
		global.is_bs_editor_env = true;
		// Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
		this.subscriptions = new CompositeDisposable();
		this.emitter = new Emitter();

		this.subscriptions.add(atom.commands.add('atom-workspace', {
			'bluespess-editor:reload-env': this.reload_env.bind(this)
		}));

		this.subscriptions.add(atom.workspace.addOpener(this.openURI.bind(this)));
		this.attachMapEditorStatusView = this.attachMapEditorStatusView.bind(this);
		this.subscriptions.add(atom.workspace.getCenter().onDidChangeActivePaneItem(this.attachMapEditorStatusView));
		this.subscriptions.add(atom.workspace.getCenter().onDidChangeActivePaneItem((item) => {
			if(item instanceof MapEditor) {
				this.showObjectTreeView();
				this.showVariantView();
			}
		}));
		// TODO remove this when atom merges my PR
		(function() {
			var _ = window.require('underscore-plus');
			var oldpick = _.pick;
			// please forgive me
			_.pick = function(...args) {
				if(args[1] == 'type' && args[2] == 'label' && args[3] == 'enabled') {
					args.push('icon');
				}
				return oldpick.call(this, ...args);
			};
		})();
		// For debugging only
		global.bs_context = this;
	},

	deactivate() {
		this.subscriptions.dispose();
		if(this.object_tree_view)
			this.object_tree_view.destroy();
		this.object_tree_view = null;
	},

	consumeStatusBar(status_bar) {
		this.status_bar = status_bar;
		return this.attachMapEditorStatusView();
	},

	attachMapEditorStatusView() {
		if(this.status_view_attached)
			return;
		if(this.status_bar == null)
			return;
		if(!(atom.workspace.getCenter().getActivePaneItem() instanceof MapEditor))
			return;

		this.status_view_attached = new MapEditorStatusView(this.status_bar);
		return this.status_view_attached.attach();
	},

	deserialize(state) {
		return IconStateEditor.deserialize(state);
	},

	reload_env() {
		var root_dir = atom.workspace.project.rootDirectories[0].path;
		var envfile_path = path.join(root_dir,".bs-env.json");
		if(!fs.existsSync(envfile_path))
			throw new Error("Environment file does not exist! You must create a .bs-env.json file.");
		var env_paths = JSON.parse(fs.readFileSync(envfile_path, "utf8"));
		global.is_bs_editor_env = true; // This flag will cause the environments to return their object instead of starting server/client
		// compile a list of all the require cache keys
		var keep_keys = new Set(Object.keys(require.cache));
		var keep_cr_keys = global.snapshotResult ? new Set(Object.keys(global.snapshotResult.customRequire.cache)) : null;
		// Load the environments
		console.log(path.join(root_dir,env_paths.server_env_path) + ", " + path.join(root_dir,env_paths.client_env_path));
		this.server_env = require(path.join(root_dir,env_paths.server_env_path));
		this.client_env = require(path.join(root_dir,env_paths.client_env_path));
		// Make the res root in the project folder
		this.client_env.resRoot = path.join(root_dir, this.server_env.resRoot);
		// Delete any new keys in the require cache so that we can do this again later if necessary
		for(let key of Object.keys(require.cache)) {
			if(!keep_keys.has(key)) {
				delete require.cache[key];
			}
		}
		if(global.snapshotResult)
			for(let key of Object.keys(global.snapshotResult.customRequire.cache)) {
				if(!keep_cr_keys.has(key)) {
					delete global.snapshotResult.customRequire.cache[key];
				}
			}
		this.emitter.emit("reloaded-env");
		this.showObjectTreeView().buildTree();
	},

	onReloadedEnv(callback) {
		var e = this.emitter.on("reloaded-env", callback);
		this.subscriptions.add(e);
		return e;
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
	},

	showObjectTreeView() {
		if(!this.object_tree_view) {
			this.object_tree_view = new ObjectTreeView(this);
			this.object_tree_view.onDidDestroy(()=>{this.object_tree_view = null;});
			if(this.server_env)
				this.object_tree_view.buildTree();
			atom.workspace.open(this.object_tree_view);
		}
		return this.object_tree_view;
	},

	showVariantView() {
		if(!this.variant_view) {
			this.variant_view = new VariantView(this);
			this.variant_view.onDidDestroy(()=>{this.variant_view = null;});
		}
		atom.workspace.open(this.variant_view);
		return this.variant_view;
	},

	async create_thumbnail(instobj) {
		if(!this.server_env)
			return Promise.resolve({width:0,height:0,data:""});
		var base_template = this.server_env.templates[instobj.template_name];
		if(!base_template)
			return Promise.resolve({width:0,height:0,data:""});
		if(!base_template.thumbnails)
			base_template.thumbnails = {};
		var key = instobj.variant_leaf_path ? JSON.stringify(instobj) : "";
		if(base_template.thumbnails[key]) {
			return base_template.thumbnails[key];
		}
		instobj = Object.assign({}, instobj);
		instobj.x = 0;
		instobj.y = 0;
		return base_template.thumbnails[key] = (async () => {
			await Promise.resolve();
			var instance = new BSMap.Instance(new BSMap(this), instobj);
			instance.client_atom.on_render_tick(performance.now());
			var bounds = instance.client_atom.get_bounds(performance.now());
			if(!bounds) {
				await instance.client_atom.fully_load();
				instance.client_atom.on_render_tick(performance.now());
				bounds = instance.client_atom.get_bounds(performance.now());
				if(!bounds)
					return (base_template.thumbnails[key] = {width:0,height:0,data:""});
			} else {
				await instance.client_atom.fully_load();
			}
			var canvas = document.createElement('canvas');
			canvas.width = bounds.width * 32;
			canvas.height = bounds.height * 32;
			var ctx = canvas.getContext('2d');
			ctx.translate(0, canvas.height - 32 - bounds.y);
			instance.client_atom.on_render_tick(0);
			instance.client_atom.draw(ctx, 0);
			instance.del();
			return (base_template.thumbnails[key] = {width:canvas.width,height:canvas.height,data:canvas.toDataURL()});
		})();
	}
};
