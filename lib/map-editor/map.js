'use babel';

import fs from 'fs-plus';
import stable_stringify from 'json-stable-stringify';

export default class BSMap {
	constructor(context) {
		this.context = context;
		
		this.grid = {};
	}
	
	async load(file) {
		var data = await new Promise((resolve, reject) => {
			fs.readFile(file, 'utf8', (err, data) => {
				if(err)
					reject(err);
				else 
					resolve(data);
			})
		});
		
		if(data.trim() == "") {
			return;
		}
		var obj = JSON.parse(data);
		
	}
}

class Instance {
	constructor(map, instobj, x, y) {
		if(+x !== +x || +y !== +y) // checks to make sure they're numbers and not NaN
			throw new TypeError(`Invalid coordinates: (${x},${y})`);
		this.x = x; this.y = y; this.z = z;
		this.instobj = instobj;
		if(typeof instobj == 'string') {
			this.template_name = instobj;
			this.copy_on_edit = true;
		}
	}
}

BSMap.Instance = Instance;