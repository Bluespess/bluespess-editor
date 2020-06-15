"use babel";
/** @jsx etch.dom */

const fs = require("fs-plus");
const { Emitter, CompositeDisposable, Disposable } = require("atom");
const etch = require("etch");

var id = 0;

var dir_progressions = [
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], // 0 dirs
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], // 1 dir
  [3, 3, 3, 3, 12, 3, 3, 3, 12, 3, 3, 3, 12, 3, 3, 3], // 2 dirs
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], // 3 dirs
  [2, 1, 2, 2, 4, 4, 2, 4, 8, 8, 8, 4, 1, 2, 2, 2], // 4 dirs
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], // 5 dirs
  [3, 3, 3, 3, 12, 5, 6, 12, 12, 9, 10, 12, 12, 3, 3, 3], // 6 dirs
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], // 7 dirs
  [2, 1, 2, 2, 4, 5, 6, 4, 8, 9, 10, 8, 4, 1, 2, 2], // 8 dirs
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], // 9 dirs
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], // 10 dirs
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], // 11 dirs
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], // 12 dirs
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], // 13 dirs
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], // 14 dirs
  [2, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], // 15 dirs
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], // 16 dirs
];

module.exports = class IconStateView {
  constructor(properties, children) {
    this.properties = properties;
    this.children = children;
    console.log(this.properties);
    this.idstart = "iconstateview" + id++;
    this.update_current_meta();
    etch.initialize(this);
    this.offsetx = 0;
    this.offsety = 0;
    this.width = 32;
    this.height = 32;
    this.keyframes = "";
    this.animate = "";
  }

  render() {
    return `
      <div
        className={
          this.idstart +
          " " +
          this.properties.class +
          " " +
          this.properties.className
        }
        attributes={{ style: this.properties.style }}
      >
        <style>{
				@keyframes ${this.idstart}anim {
					${this.keyframes}
				}
				.${this.idstart} {
					background-image: url(${this.properties.icon});
					background-position: ${-this.offsetx}px ${-this.offsety}px;
					width: ${this.width}px;
					height: ${this.height}px;
					${this.animate};
				}
				}</style>
      </div>
    `;
  }

  update(properties, children) {
    this.properties = properties;
    this.children = children;
    console.log(this.properties);
    this.update_current_meta();
    return etch.update(this);
  }

  update_current_meta() {
    this.keyframes = "";
    this.animate = "";
    if (!this.properties.meta) {
      return;
    }
    var icon_state_meta = this.properties.meta[this.properties.icon_state];
    if (!icon_state_meta) icon_state_meta = this.properties.meta[" "];
    if (!icon_state_meta) icon_state_meta = this.properties.meta[""];
    if (!icon_state_meta) {
      return;
    }
    var progression = icon_state_meta.dir_progression;
    if (!progression) progression = dir_progressions[icon_state_meta.dirCount];
    if (!progression) progression = dir_progressions[1];
    var computed_dir = progression[this.properties.dir];
    if (computed_dir == undefined || !icon_state_meta.dirs[computed_dir])
      computed_dir = 2;
    if (computed_dir == undefined || !icon_state_meta.dirs[computed_dir]) {
      return;
    }
    var dir_meta = icon_state_meta.dirs[computed_dir];
    var frame = this.properties.frame != undefined ? this.properties.frame : 0;
    var frame_meta = dir_meta.frames[frame];
    if (!frame_meta) frame_meta = frame_meta[0];
    if (frame_meta) {
      this.offsetx = frame_meta.x;
      this.offsety = frame_meta.y;
    }
    this.width = icon_state_meta.width;
    this.height = icon_state_meta.height;
    if (dir_meta.frames.length <= 1 || this.properties.frame != undefined) {
      return;
    }
    var total_delay = 0;
    for (let i = 0; i < dir_meta.frames.length; i++) {
      total_delay += dir_meta.frames[i].delay;
    }
    var time = 0;
    for (var i = 0; i < dir_meta.frames.length; i++) {
      frame_meta = dir_meta.frames[i];
      this.keyframes += `${
        100 * (time / total_delay)
      }% {background-position: ${-frame_meta.x}px ${-frame_meta.y}px}`;
      time += frame_meta.delay;
    }
    this.animate = `animation: ${total_delay / 1000}s step-end infinite ${
      this.idstart
    }anim`;
  }
};
