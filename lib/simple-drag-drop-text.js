/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

/*
  lib/simple-drag-drop-text.coffee
*/

const SubAtom = require('sub-atom');

class SimpleDragDropText {
  static initClass() {
    this.prototype.config = {
      copyKey: {
        type: 'string',
        default: 'ctrl',
        description: 'Select modifier key for copy action',
        enum: ['alt', 'ctrl', 'meta'],
      },
      delay: {
        type: 'integer',
        default: 500,
        minimum: 1,
        description: 'Hold click for this duration to enable drag',
      },
    };
  }

  activate() {
    this.subs = new SubAtom();
    this.canDrag = false;

    this.subs.add('body', 'mouseup', (e) => {
      if (this.mouseIsDown) {
        return this.clear(
          e[atom.config.get('simple-drag-drop-text.copyKey') + 'Key']
        );
      }
    });
    this.subs.add(
      atom.workspace.observeTextEditors((editor) => this.setEditor())
    );
    return this.subs.add(
      atom.workspace.onDidChangeActivePaneItem((editor) => this.setEditor())
    );
  }

  setEditor() {
    return process.nextTick(() => {
      if (!(this.editor = atom.workspace.getActiveTextEditor())) {
        this.clear();
        return;
      }

      this.userDelay = atom.config.get('simple-drag-drop-text.delay') || 500;
      if (this.linesSubs != null) {
        this.linesSubs.dispose();
      }
      this.views = atom.views.getView(this.editor);
      this.lines = this.views.querySelector('.lines');
      this.linesSubs = new SubAtom();
      this.linesSubs.add(this.lines, 'mousedown', (e) => this.mousedown(e));
      return this.linesSubs.add(this.lines, 'mousemove', (e) => {
        if (this.mouseIsDown && this.canDrag && e.which > 0) {
          return this.drag();
        } else {
          return this.clear();
        }
      });
    });
  }

  mousedown(e) {
    if (!this.editor) {
      this.clear();
      return;
    }

    this.selMarker = this.editor.getLastSelection().marker;
    this.selBufferRange = this.selMarker.getBufferRange();
    if (this.selBufferRange.isEmpty()) {
      return;
    }

    let inSelection = false;

    this.highlights = this.views.querySelector('.highlights');

    this.highlights
      .querySelectorAll('.highlight.selection .region')
      .forEach((ele) => {
        const { left, top, right, bottom } = ele.getBoundingClientRect();
        if (
          left <= e.pageX &&
          e.pageX < right &&
          top <= e.pageY &&
          e.pageY < bottom
        ) {
          inSelection = true;
          return false;
        }
      });
    if (!inSelection) {
      return;
    }

    this.text = this.editor.getTextInBufferRange(this.selBufferRange);
    this.marker = this.editor.markBufferRange(
      this.selBufferRange,
      this.selMarker.getProperties()
    );
    this.editor.decorateMarker(this.marker, {
      type: 'highlight',
      class: 'selection',
    });

    this.mouseIsDown = true;
    return setTimeout(() => {
      return (this.canDrag = true);
    }, this.userDelay);
  }

  drag() {
    this.isDragging = true;
    const selection = this.editor.getLastSelection();
    return process.nextTick(() => selection.clear());
  }

  drop(altKey) {
    const checkpointBefore = this.editor.createCheckpoint();
    if (!altKey) {
      this.editor.setTextInBufferRange(this.selBufferRange, '');
    }
    const cursorPos = this.editor
      .getLastSelection()
      .marker.getBufferRange().start;
    this.editor.setTextInBufferRange([cursorPos, cursorPos], this.text);
    return this.editor.groupChangesSinceCheckpoint(checkpointBefore);
  }

  clear(altKey) {
    if (altKey != null && this.isDragging) {
      this.drop(altKey);
    }
    this.mouseIsDown = this.isDragging = this.canDrag = false;
    return this.marker != null ? this.marker.destroy() : undefined;
  }

  deactivate() {
    this.clear();
    if (this.linesSubs != null) {
      this.linesSubs.dispose();
    }
    return this.subs.dispose();
  }
}
SimpleDragDropText.initClass();

module.exports = new SimpleDragDropText();
