'use babel';
/** @jsx etch.dom */

const {Emitter, CompositeDisposable, Disposable} = require('atom');
const etch = require('etch');
const BSMap = require('./map');


module.exports = class MapEditorView {
	constructor (editor) {
		this.editor = editor;
		this.emitter = new Emitter();
		this.disposables = new CompositeDisposable();

}
