"use strict";

const { Emitter, CompositeDisposable, Disposable } = require("atom");

class ObjectTreeView {
  constructor(context) {
    this.context = context;

    this.element = document.createElement("div");
    this.element.classList.add("tool-panel", "object-tree-view");
    this.element.tabIndex = -1;

    this.list = document.createElement("ol");
    this.list.classList.add(
      "object-tree-view-root",
      "full-menu",
      "list-tree",
      "has-collapsable-children",
      "focusable-panel"
    );
    this.element.appendChild(this.list);

    this.tree = [];
    this.tree_map = {};
    this.emitter = new Emitter();
    this.disposables = new CompositeDisposable();
    this.selected = null;

    this.handleClick = this.handleClick.bind(this);
    this.list.addEventListener("click", this.handleClick);
    this.disposables.add(
      new Disposable(() => {
        this.list.removeEventListener("click", this.handleClick);
      })
    );
  }
  destroyTree() {
    for (var node of this.tree) {
      node.destroy();
    }
    this.tree = [];
    this.tree_map = {};
    this.list.innerHTML = "";
  }

  destroy() {
    this.emitter.emit("did-destroy");
    this.disposables.dispose();
    this.destroyTree();
  }

  handleClick(e) {
    if (
      !e.shiftKey &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.target.classList.contains("entries")
    ) {
      var entry = e.target.closest(".entry");
      if (entry) {
        if (entry.toggleExpansion) entry.toggleExpansion();
        if (entry.tree_node) this.setSelectedNode(entry.tree_node);
      }
    }
  }

  buildTree() {
    this.destroyTree();
    for (var template_name in this.context.server_env.templates) {
      if (!this.context.server_env.templates.hasOwnProperty(template_name))
        continue;
      var template = this.context.server_env.templates[template_name];
      this.context.server_env.process_template(template);
      if (template.hidden) continue;
      if (!template.tree_paths) {
        template.tree_paths = ["uncategorized/[name]"];
      }
      for (var tree_path of template.tree_paths) {
        var tree_path_split = tree_path.split("/");
        var last_node = null;
        for (var node_name of tree_path_split) {
          if (node_name == "") continue;
          if (node_name == "[name]") node_name = template_name;
          let node = last_node
            ? last_node.children_map[node_name]
            : this.tree_map[node_name];
          if (!node) {
            node = new ObjectTreeNode(this, node_name, last_node);
            if (last_node == null) {
              this.tree.push(node);
              this.tree_map[node_name] = node;
            }
          }
          last_node = node;
        }
        last_node.template = template;
        last_node.template_name = template_name;
      }
    }
    this.tree.sort(node_comparator);
    for (let node of this.tree) {
      this.list.appendChild(node.createElement());
    }
  }
  getTitle() {
    return "Map Objects";
  }
  onDidDestroy(callback) {
    var e = this.emitter.on("did-destroy", callback);
    this.disposables.add(e);
    return e;
  }
  onSelectionChanged(callback) {
    var e = this.emitter.on("selection-changed", callback);
    this.disposables.add(e);
    return e;
  }
  getDefaultLocation() {
    return "left";
  }
  getAllowedLocations() {
    return ["left", "right"];
  }
  setSelectedNode(node) {
    if (node && !node.template)
      // no
      return;
    if (node == this.selected) return;
    if (this.selected && this.selected.element) {
      this.selected.element.classList.remove("selected");
    }
    this.selected = node;
    if (this.selected && this.selected.element) {
      this.selected.element.classList.add("selected");
    }
    this.emitter.emit("selection-changed");
  }
}

class ObjectTreeNode {
  constructor(view, name, parent = null) {
    this.name = name;
    this.template = null;
    this.template_name = null;
    this.children = [];
    this.children_map = {};
    this.parent = parent;
    this.view = view;
    if (this.parent) {
      this.parent.children.push(this);
      this.parent.children_map[name] = this;
    }

    this.expanded = false;
    this.element = null;
    this.name_span;
    this.list_element = null;
  }

  createElement() {
    if (this.element) return this.element;
    this.children.sort(node_comparator);
    this.element = document.createElement("li");
    this.element.tree_node = this;
    if (this.children.length) {
      this.element.classList.add(
        "directory",
        "entry",
        "list-nested-item",
        "collapsed"
      );
      this.toggleExpansion = this.toggleExpansion.bind(this);
      this.element.toggleExpansion = this.toggleExpansion;

      var headerDiv = document.createElement("div");
      headerDiv.classList.add("header", "list-item");
      this.element.appendChild(headerDiv);

      this.name_span = document.createElement("span");
      this.name_span.classList.add("name", "icon");
      this.name_span.innerText = this.name;
      headerDiv.appendChild(this.name_span);
      if (!this.template) this.name_span.classList.add("icon-file-directory");

      this.list_element = document.createElement("ol");
      this.list_element.classList.add("entries", "list-tree");
      this.element.appendChild(this.list_element);
    } else {
      this.element.classList.add("file", "entry", "list-item");
      this.name_span = document.createElement("span");
      this.name_span.classList.add("name", "icon");
      this.name_span.innerText = this.name;
      this.element.appendChild(this.name_span);
    }
    if (this.template) {
      this.view.context
        .create_thumbnail({ template_name: this.template_name })
        .then((thumbnail) => {
          var img = document.createElement("img");
          img.src = thumbnail.data;
          img.classList.add("object-tree-thumbnail");
          this.name_span.insertBefore(img, this.name_span.firstChild);
        });
    }
    return this.element;
  }

  destroy() {
    for (var child of this.children) {
      child.destroy();
    }
    this.children.length = 0;
    this.parent = null;
  }

  toggleExpansion() {
    if (this.expanded) {
      this.collapse();
    } else {
      this.expand();
    }
  }

  expand() {
    if (this.expanded || !this.list_element) return;
    for (var child of this.children) {
      this.list_element.appendChild(child.createElement());
    }
    this.element.classList.remove("collapsed");
    this.element.classList.add("expanded");
    this.expanded = true;
  }

  collapse() {
    if (!this.expanded || !this.list_element) return;
    while (this.list_element.firstChild) {
      this.list_element.removeChild(this.list_element.firstChild);
    }
    this.element.classList.remove("expanded");
    this.element.classList.add("collapsed");
    this.expanded = false;
  }
}

function node_comparator(a, b) {
  return a.name > b.name ? 1 : a.name == b.name ? 0 : -1;
}

module.exports = ObjectTreeView;
