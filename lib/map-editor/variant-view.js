'use strict';

const {Emitter, CompositeDisposable, Disposable} = require('atom');

module.exports = class VariantView {
	constructor(context) {
		this.context = context;

		this.element = document.createElement("div");
		this.element.classList.add("tool-panel", "variant-view");
		this.element.tabIndex = -1;

		this.emitter = new Emitter();
		this.disposables = new CompositeDisposable();
		this.selected = null;
		this.node_map = {};

		this.handleClick = this.handleClick.bind(this);
		this.element.addEventListener("click", this.handleClick);
		this.disposables.add(new Disposable(()=>{this.element.removeEventListener("click", this.handleClick);}));

		this.build_variants = this.build_variants.bind(this);
		this.disposables.add(this.context.showObjectTreeView().onSelectionChanged(this.build_variants));
	}
	destroy_variants() {
		this.element.innerHTML = "";
		this.node_map = {};
		this.selected = null;
	}

	async build_variants() {
		this.destroy_variants();
		try {
			var template = this.context.object_tree_view.selected.template;
			var template_name = this.context.object_tree_view.selected.template_name;
			this.context.server_env.process_template(template);
			this.element.appendChild(await this.build_variants_for_path([], template, template_name));
		} catch(e) {
			console.error(e);
		}
	}

	async build_variants_for_path(path, template, template_name) {
		var base_element = document.createElement("div");
		this.node_map[JSON.stringify(path)] = base_element;
		base_element.classList.add("variant-node");
		base_element.dataset.path = JSON.stringify(path);
		if(!template.variants || path.length >= template.variants.length) {
			var img_element = document.createElement("img");
			var thumbnail = await this.context.create_thumbnail({template_name, variant_leaf_path: path});
			img_element.src = thumbnail.data;
			img_element.width = thumbnail.width;
			img_element.height = thumbnail.height;
			base_element.appendChild(img_element);
			base_element.classList.add("variant-leaf");
		} else {
			var variant = template.variants[path.length];
			if(variant.type == "single") {
				for(var i = 0; i < variant.values.length; i++) {
					if(variant.wrap && i != 0 && (i % variant.wrap) == 0) {
						base_element.appendChild(document.createElement("br"));
					}
					var new_path = path.slice();
					new_path.push(variant.values[i]);
					try {
						var variant_element = await this.build_variants_for_path(new_path, template, template_name);
						var variant_element_container = document.createElement("div");
						variant_element_container.appendChild(variant_element);
						if(variant.label) {
							var textnode = document.createTextNode((variant.label_prefix || "") + variant.values[i] + (variant.label_suffix || ""));
							if(variant.put_label_before) {
								variant_element_container.insertBefore(textnode, variant_element);
							} else {
								variant_element_container.appendChild(textnode);
							}
						}
						if(variant.orientation == "vertical") {
							variant_element_container.classList.add("vertical-node-container");
						} else {
							variant_element_container.classList.add("horizontal-node-container");
						}
						base_element.appendChild(variant_element_container);
					} catch(e) {
						console.error(e);
					}
				}
			}
		}
		return base_element;
	}

	destroy() {
		this.emitter.emit("did-destroy");
		this.disposables.dispose();
		this.destroy_variants();
	}

	handleClick(e) {
		if(!e.shiftKey  && !e.ctrlKey && !e.metaKey) {
			var entry = e.target.closest('.variant-leaf');
			if(entry) {
				if(entry.dataset.path)
					this.setSelectedPath(JSON.parse(entry.dataset.path));
			}
		}
	}

	getTitle() {
		return "Map Object Variants";
	}
	onDidDestroy(callback) {
		var e = this.emitter.on("did-destroy", callback);
		this.disposables.add(e);
		return e;
	}
	getDefaultLocation() {
		return 'right';
	}
	getAllowedLocations() {
		return ['left','right'];
	}
	setSelectedPath(path) {
		if(!path || path == this.selected)
			return;
		if(this.selected)
			this.node_map[JSON.stringify(this.selected)].classList.remove("selected");
		this.selected = path;
		if(this.selected)
			this.node_map[JSON.stringify(this.selected)].classList.add("selected");
	}
}
