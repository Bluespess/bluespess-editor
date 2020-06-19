'use strict';

const fs = require('fs-plus');
const stable_stringify = require('json-stable-stringify');
const {deepAssign} = require('../util');

class BSMap {
	constructor(context) {
		this.context = context;

		this.objects = [];
		this.grid = {};
		this.modified = false;
		this.needs_sort = true;
	}

	async load(file) {
		var data = await new Promise((resolve, reject) => {
			fs.readFile(file, 'utf8', (err, data) => {
				if(err)
					reject(err);
				else
					resolve(data);
			});
		});

		if(data.trim() == "") {
			// If it's an empty file give the user a blank slate
			// instead of just crashing
			return;
		}
		var obj = JSON.parse(data);
		for(var loc in obj.locs) {
			if(!obj.locs.hasOwnProperty(loc))
				continue;
			for(var instobj of obj.locs[loc]) {
				new Instance(this, instobj);
			}
		}
		for(let obj of this.objects.slice()) {
			if(!obj.deleted) {
				obj.finalize_movement();
			}
		}
	}

	save(file) {
		var obj = {locs: {}};
		for(var inst of this.objects) {
			var locstring = `${inst.x},${inst.y},0`;
			var loc = obj.locs[locstring] || (obj.locs[locstring] = []);
			loc.push(inst.instobj);
		}
		var data = stable_stringify(obj, {space: "\t", cmp: (a, b) => {
			var a_coords = /(-?[0-9]+),(-?[0-9]+),(-?[0-9]+)/.exec(a.key);
			var b_coords = /(-?[0-9]+),(-?[0-9]+),(-?[0-9]+)/.exec(b.key);
			if(a_coords && b_coords) {
				return (+a_coords[3] - +b_coords[3]) || (+a_coords[2] - +b_coords[2]) || (+a_coords[1] - +b_coords[1]);
			}
			return a.key > b.key ? 1 : -1;
		}});
		return new Promise((resolve, reject) => {
			fs.writeFile(file, data, (err) => {
				if(err) {
					reject(err);
				} else {
					this.modified = false;
					resolve();
				}
			});
		});
	}
	sort_objects() {
		this.needs_sort = false;
		this.objects.sort((a,b) => {return this.context.client_env.constructor.Atom.atom_comparator(a.client_atom, b.client_atom);});
	}
}

// woo duck typing
class Instance {
	constructor(map, instobj) {
		var x = instobj.x, y = instobj.y;
		if(x !== +x || y !== +y) // checks to make sure they're numbers and not NaN
			throw new TypeError(`Invalid coordinates: (${x},${y})`);
		this.map = map;
		this.deleted = false;
		this.map.objects.push(this);
		this.instobj = instobj;
		this.set_pos(x,y);
		this.last_x = null;
		this.last_y = null;
		this.template_name = instobj.template_name;
		this.instance_vars = instobj.instance_vars;
		this.computed_vars = null;
		this.update_context();
	}

	set_pos(x, y) {
		if((x != null || y != null) && (x !== +x || y !== +y)) // checks to make sure they're numbers and not NaN
			throw new TypeError(`Invalid coordinates: (${x},${y})`);
		if(this.grid_tile) {
			var idx;
			(idx = this.grid_tile.indexOf(this)) != -1 && this.grid_tile.splice(idx, 1);
		}
		this.x = x; this.y = y;
		if(this.x != null && this.y != null) {
			this.grid_tile = this.map.grid[`${this.x},${this.y}`] || (this.map.grid[`${this.x},${this.y}`] = []);
			this.grid_tile.push(this);
			this.grid_tile.sort((a,b) => {return this.map.context.client_env.constructor.Atom.atom_comparator(a.client_atom, b.client_atom);});
		}
		this.map.needs_sort = true;
		this.instobj.x = x;
		this.instobj.y = y;
	}

	update_context(force = false) {
		var new_template = this.map.context.server_env.templates[this.template_name];
		if(new_template === this.base_template && !force)
			return;
		this.map.context.server_env.process_template(new_template);
		this.base_template = new_template;

		this.computed_vars = JSON.parse(JSON.stringify(this.base_template.vars));
		Object.assign(this.computed_vars, this.computed_vars.appearance);
		delete this.computed_vars.appearance;
		if(this.base_template.variants && this.base_template.variants.length) {
			if(!this.variant_leaf_path)
				this.variant_leaf_path = [];
			this.variant_leaf_path.length = this.base_template.variants.length;
			for(var i = 0; i < this.base_template.variants.length; i++) {
				var variant = this.base_template.variants[i];
				if(variant.type == "single") {
					var idx = variant.values.indexOf(this.variant_leaf_path[i]);
					if(idx == -1 || this.variant_leaf_path.length <= i) {
						idx = 0;
						this.variant_leaf_path[i] = variant.values[idx];
					}
					var curr_obj = this.computed_vars;
					for(var j = 0; j < variant.var_path.length - 1; j++) {
						if(j == 0 && variant.var_path[j] == "appearance")
							continue;
						curr_obj = curr_obj[variant.var_path[j]];
					}
					curr_obj[variant.var_path[variant.var_path.length - 1]] = variant.values[idx];
				}
			}
		} else {
			this.variant_leaf_path = undefined;
		}
		if(this.instance_vars) {
			deepAssign(this.computed_vars, this.instance_vars);
			Object.assign(this.computed_vars, this.instance_vars.appearance);
		}
		delete this.computed_vars.appearance;

		var client_instobj = {components: [], component_vars: this.computed_vars.components || {}};
		for(var key of ['icon', 'icon_state', 'dir', 'layer', 'name', 'glide_size', 'screen_loc_x', 'screen_loc_y', 'overlays', 'x', 'y'])
			client_instobj[key] = this.computed_vars[key];
		this.client_atom = new this.map.context.client_env.constructor.Atom(this.map.context.client_env, client_instobj);

		if(this.base_template.components)
			for(let component_name of this.base_template.components) {
				let component_class = this.map.context.server_env.components[component_name];
				if(component_class && component_class.update_map_instance) {
					component_class.update_map_instance(this);
				}
			}

		this.map.context.create_thumbnail(this.instobj, this).then(thumbnail => {
			this.thumbnail = thumbnail;
		});

		this.last_x = null;
		this.last_y = null;
	}

	finalize_movement() {
		if(this.last_x == this.x && this.last_y == this.y)
			return;
		if(this.last_x != null && this.last_y != null) {
			let last_tile = this.map.grid[`${this.last_x},${this.last_y}`] || (this.map.grid[`${this.last_x},${this.last_y}`] = []);
			for(let obj of last_tile) {
				if(obj == this)
					continue;
				if(obj.base_template.requires_under) {
					if((obj.base_template.requires_under.component && this.base_template.components.indexOf(obj.base_template.requires_under.component) == -1)
					|| (obj.base_template.requires_under.template == this.template_name)) {
						if(obj.base_template.requires_under.default) {
							(new Instance(this.map, {template_name: obj.base_template.requires_under.default, x: obj.x, y: obj.y})).finalize_movement();
						} else {
							obj.del();
						}
					}
				}
			}
		}
		this.last_x = this.x;
		this.last_y = this.y;
		if(this.x != null && this.y != null) {
			if(this.base_template.tile_bound) {
				this.set_pos(Math.round(this.x), Math.round(this.y));
			}
			if(this.base_template.requires_under) {
				let success = false;
				for(let obj of this.grid_tile) {
					if((this.base_template.requires_under.component && obj.base_template.components.includes(this.base_template.requires_under.component))
					|| (this.base_template.requires_under.template == obj.template_name)) {
						success = true;
						break;
					}
				}
				if(!success) {
					if(this.base_template.requires_under.default) {
						(new Instance(this.map, {template_name: this.base_template.requires_under.default, x: this.x, y: this.y})).finalize_movement();
					} else {
						this.del();
					}
				}
			}
			for(let component_name of this.base_template.components) {
				var component = this.map.context.server_env.components[component_name];
				if(component.one_per_tile) {
					for(let obj of this.grid_tile) {
						if(obj == this)
							continue;
						if(obj.base_template.components.indexOf(component_name) != -1) {
							obj.del();
						}
					}
				}
			}
		}
	}

	get variant_leaf_path() {
		return this.instobj.variant_leaf_path;
	}
	set variant_leaf_path(val) {
		this.instobj.variant_leaf_path = val;
	}

	del() {
		this.deleted = true;
		this.set_pos(null,null);
		this.finalize_movement();
		this.client_atom.del();
		var idx = this.map.objects.indexOf(this);
		if(idx != -1)
			this.map.objects.splice(idx, 1);
	}
}

BSMap.Instance = Instance;

module.exports = BSMap;
