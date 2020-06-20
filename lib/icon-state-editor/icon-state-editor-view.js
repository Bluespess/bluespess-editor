"use strict";
/** @jsx etch.dom */

const fs = require('fs-plus');
const {Emitter, CompositeDisposable, Disposable} = require('atom');
const etch = require('etch');
const IconStateView = require('./icon-state-view');

const screenslist = ["listpage", "dirspage", "imagepage"];

// View that renders the image of an {ImageEditor}.
module.exports = class IconStateEditorView {
	constructor (editor) {
		this.editor = editor;
		this.emitter = new Emitter();
		this.disposables = new CompositeDisposable();
		this.imageSize = fs.statSync(this.editor.getPath()).size;
		this.loaded = false;
		this.mode = 'reset-zoom';
		etch.initialize(this);

		//this.refs.image.style.display = 'none';
		this.updateImageURI();

		this.selectScreen("listpage");

		this.disposables.add(this.editor.onDidChange(() => this.updateImageURI()));
		this.disposables.add(atom.commands.add(this.element, {
			'image-view:reload': () => this.updateImageURI(),
			'image-view:zoom-in': () => this.zoomIn(),
			'image-view:zoom-out': () => this.zoomOut(),
			'image-view:zoom-to-fit': () => this.zoomToFit(),
			'image-view:reset-zoom': () => this.resetZoom(),
			'core:move-up': () => { this.scrollUp(); },
			'core:move-down': () => { this.scrollDown(); },
			'core:page-up': () => { this.pageUp(); },
			'core:page-down': () => { this.pageDown(); },
			'core:move-to-top': () => { this.scrollToTop(); },
			'core:move-to-bottom': () => { this.scrollToBottom(); }
		}));

		this.refs.image.onload = () => {
			this.refs.image.onload = null;
			this.originalHeight = this.refs.image.naturalHeight;
			this.originalWidth = this.refs.image.naturalWidth;
			this.loaded = true;
			this.refs.image.style.display = '';
			this.emitter.emit('did-load');
		};

		this.disposables.add(atom.tooltips.add(this.refs.whiteTransparentBackgroundButton, {title: 'Use white transparent background ree'}));
		this.disposables.add(atom.tooltips.add(this.refs.blackTransparentBackgroundButton, {title: 'Use black transparent background ree'}));
		this.disposables.add(atom.tooltips.add(this.refs.transparentTransparentBackgroundButton, {title: 'Use transparent background ree'}));

		const clickHandler = (event) => {
			event.preventDefault();
			event.stopPropagation();
			this.changeBackground(event.target.value);
		};

		this.refs.whiteTransparentBackgroundButton.addEventListener('click', clickHandler);
		this.disposables.add(new Disposable(() => { this.refs.whiteTransparentBackgroundButton.removeEventListener('click', clickHandler); }));
		this.refs.blackTransparentBackgroundButton.addEventListener('click', clickHandler);
		this.disposables.add(new Disposable(() => { this.refs.blackTransparentBackgroundButton.removeEventListener('click', clickHandler); }));
		this.refs.transparentTransparentBackgroundButton.addEventListener('click', clickHandler);
		this.disposables.add(new Disposable(() => { this.refs.transparentTransparentBackgroundButton.removeEventListener('click', clickHandler); }));

		const zoomInClickHandler = () => {
			this.zoomIn();
		};
		this.refs.zoomInButton.addEventListener('click', zoomInClickHandler);
		this.disposables.add(new Disposable(() => { this.refs.zoomInButton.removeEventListener('click', zoomInClickHandler); }));

		const zoomOutClickHandler = () => {
			this.zoomOut();
		};
		this.refs.zoomOutButton.addEventListener('click', zoomOutClickHandler);
		this.disposables.add(new Disposable(() => { this.refs.zoomOutButton.removeEventListener('click', zoomOutClickHandler); }));

		const resetZoomClickHandler = () => {
			this.resetZoom();
		};
		this.refs.resetZoomButton.addEventListener('click', resetZoomClickHandler);
		this.disposables.add(new Disposable(() => { this.refs.resetZoomButton.removeEventListener('click', resetZoomClickHandler); }));

		const zoomToFitClickHandler = () => {
			this.zoomToFit();
		};
		this.refs.zoomToFitButton.addEventListener('click', zoomToFitClickHandler);
		this.disposables.add(new Disposable(() => { this.refs.zoomToFitButton.removeEventListener('click', zoomToFitClickHandler); }));
	}

	onDidLoad (callback) {
		return this.emitter.on('did-load', callback);
	}

	update () {return etch.update(this);}

	metaFileChanged() {
		this.update();
		return;
	}

	destroy () {
		this.disposables.dispose();
		this.emitter.dispose();
		return etch.destroy(this);
	}

	selectIconState(name) {
		console.log(name);
		this.selectScreen("dirspage");
	}

	selectScreen(screenName) {
		for(var listscreen of screenslist)
			this.refs[listscreen].style.display = "none";
		this.refs[screenName].style.display = "block";
	}

	getStateViews() {
		var list = [];
		if(!this.editor.iconMeta)
			return list;
		for(let key in this.editor.iconMeta) {
			if(!this.editor.iconMeta.hasOwnProperty(key))
				continue;
			list.push(`<div className='icon-state-list-item' title=${key} onclick==${this.selectIconState.bind(this, key)}>
				<IconStateView icon==${this.refs && this.refs.image && this.refs.image.src} meta==${this.editor.iconMeta} icon_state==${key} className='icon-state-img' />
				<div className='icon-state-label' style==${{width: Math.max(64, this.editor.iconMeta[key].width)+"px"}}>=${key}</div>
			</div>`);
		}
		console.log("<div></div>");
		return list;
	}

	render () {
		return (`
			<div className='image-view bluespess-editor' tabIndex='-1'>
				<div ref="listpage" className='icon-state-list'>
					<div ref='statelist'>=${this.getStateViews()}</div>
				</div>
				<div ref="dirspage" className='dir-list'>
					<div className="dir0"></div>
					<div className="dir1"></div>
					<div className="dir2"></div>
					<div className="dir3"></div>
					<div className="dir4"></div>
					<div className="dir5"></div>
					<div className="dir6"></div>
					<div className="dir7"></div>
					<div className="dir8"></div>
					<div className="dir9"></div>
					<div className="dir10"></div>
					<div className="dir11"></div>
					<div className="dir12"></div>
					<div className="dir13"></div>
					<div className="dir14"></div>
					<div className="dir15"></div>
				</div>
				<div ref="imagepage">
					<div className='image-controls' ref='imageControls'>
						<div className='image-controls-group'>
							<a ref='whiteTransparentBackgroundButton' className='image-controls-color-white' value='white'>white</a>
							<a ref='blackTransparentBackgroundButton' className='image-controls-color-black' value='black'>black</a>
							<a ref='transparentTransparentBackgroundButton' className='image-controls-color-transparent' value='transparent'>transparent</a>
							<IconStateView icon=${this.refs && this.refs.image && this.refs.image.src} meta=${this.editor.iconMeta} icon_state="thesingulo" />
						</div>
						<div className='image-controls-group btn-group'>
							<button className='btn' ref='zoomOutButton'>-</button>
							<button className='btn reset-zoom-button' ref='resetZoomButton'>100%</button>
							<button className='btn' ref='zoomInButton'>+</button>
						</div>
						<div className='image-controls-group btn-group'>
							<button className='btn' ref='zoomToFitButton'>Zoom to fit</button>
						</div>
					</div>
					<div className='image-container' ref='imageContainer'>
						<img ref='image'></img>
					</div>
				</div>
			</div>
		`);
	}

	updateImageURI () {
		this.refs.image.src = `${this.editor.getEncodedURI()}?time=${Date.now()}`;
		etch.update(this);
	}

	// Zooms the image out by 25%.
	zoomOut () {
		this.adjustSize(0.75);
	}

	// Zooms the image in by 25%.
	zoomIn () {
		this.adjustSize(1.25);
	}

	// Zooms the image to its normal width and height.
	resetZoom () {
		if (!this.loaded || this.element.offsetHeight === 0) {
			return;
		}

		this.mode = 'reset-zoom';
		this.refs.imageContainer.classList.remove('zoom-to-fit');
		this.refs.zoomToFitButton.classList.remove('selected');
		this.refs.image.style.width = this.originalWidth + 'px';
		this.refs.image.style.height = this.originalHeight + 'px';
		this.refs.resetZoomButton.textContent = '100%';
	}

	// Zooms to fit the image, doesn't scale beyond actual size
	zoomToFit () {
		if (!this.loaded || this.element.offsetHeight === 0) {
			return;
		}

		this.mode = 'zoom-to-fit';
		this.refs.imageContainer.classList.add('zoom-to-fit');
		this.refs.zoomToFitButton.classList.add('selected');
		this.refs.image.style.width = '';
		this.refs.image.style.height = '';
		this.refs.resetZoomButton.textContent = 'Auto';
	}

	// Adjust the size of the image by the given multiplying factor.
	//
	// factor - A {Number} to multiply against the current size.
	adjustSize (factor) {
		if (!this.loaded || this.element.offsetHeight === 0) {
			return;
		}

		if (this.mode === 'zoom-to-fit') {
			this.mode = 'zoom-manual';
			this.refs.imageContainer.classList.remove('zoom-to-fit');
			this.refs.zoomToFitButton.classList.remove('selected');
		} else if (this.mode === 'reset-zoom') {
			this.mode = 'zoom-manual';
		}

		const newWidth = this.refs.image.offsetWidth * factor;
		const newHeight = this.refs.image.offsetHeight * factor;
		const percent = Math.max(1, Math.round((newWidth / this.originalWidth) * 100));

		// Switch to pixelated rendering when image is bigger than 200%
		if (newWidth > (this.originalWidth * 2)) {
			this.refs.image.style.imageRendering = 'pixelated';
		} else {
			this.refs.image.style.imageRendering = '';
		}

		this.refs.image.style.width = newWidth + 'px';
		this.refs.image.style.height = newHeight + 'px';
		this.refs.resetZoomButton.textContent = percent + '%';
	}

	// Changes the background color of the image view.
	//
	// color - A {String} that gets used as class name.
	changeBackground (color) {
		if (this.loaded && this.element.offsetHeight > 0 && color) {
			this.refs.imageContainer.setAttribute('background', color);
		}
	}

	scrollUp () {
		this.refs.imageContainer.scrollTop -= document.body.offsetHeight / 20;
	}

	scrollDown () {
		this.refs.imageContainer.scrollTop += document.body.offsetHeight / 20;
	}

	pageUp () {
		this.refs.imageContainer.scrollTop -= this.element.offsetHeight;
	}

	pageDown () {
		this.refs.imageContainer.scrollTop += this.element.offsetHeight;
	}

	scrollToTop () {
		this.refs.imageContainer.scrollTop = 0;
	}

	scrollToBottom () {
		this.refs.imageContainer.scrollTop = this.refs.imageContainer.scrollHeight;
	}
};
