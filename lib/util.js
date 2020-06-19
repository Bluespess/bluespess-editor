'use strict';
function deepAssign(a, b) {
	var keys = Object.keys(b);
	for(var i = 0; i < keys.length; i++) {
		var key = keys[i];
		var aobj = a[key];
		var bobj = b[key];
		if(typeof bobj == "object" && !(bobj instanceof Array)) {
			if(typeof aobj == "object" && !(aobj instanceof Array)) {
				deepAssign(aobj, bobj);
			} else {
				a[key] = deepAssign({}, bobj);
			}
		} else if(b.hasOwnProperty(key)) {
			a[key] = bobj;
		}
	}
	return a;
}

module.exports = {deepAssign};
