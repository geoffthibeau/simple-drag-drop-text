/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

const SubAtom = require('sub-atom');

const defaultDelay = 500;
const keys = {
  ctrl: 'Control',
  alt: 'Alt',
  meta: 'Meta',
};
const isCopyingClassName = 'simple-drag-drop-text--isDraggingAndCopying';

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
        default: defaultDelay,
        minimum: 1,
        description: 'Hold click for this duration to enable drag',
      },
    };
  }

  activate() {
    this.subs = new SubAtom();
    this.canDrag = false;

    this.subs.add('body', 'mouseup', (event) => {
      if (this.mouseIsDown) {
        return this.clear(
          event[atom.config.get('simple-drag-drop-text.copyKey') + 'Key']
        );
      }
    });

    this.subs.add('body', 'keydown', (event) => {
      if (
        this.mouseIsDown &&
        event[atom.config.get('simple-drag-drop-text.copyKey') + 'Key']
      ) {
        this.views.classList.add(isCopyingClassName);
      }
    });

    this.subs.add('body', 'keyup', (event) => {
      if (
        event.key === keys[atom.config.get('simple-drag-drop-text.copyKey')]
      ) {
        this.views.classList.remove(isCopyingClassName);
      }
    });

    this.subs.add(atom.workspace.observeTextEditors(() => this.setEditor()));

    return this.subs.add(
      atom.workspace.onDidChangeActivePaneItem(() => this.setEditor())
    );
  }

  setEditor() {
    return process.nextTick(() => {
      if (!(this.editor = atom.workspace.getActiveTextEditor())) {
        this.clear();

        return;
      }

      this.userDelay =
        atom.config.get('simple-drag-drop-text.delay') || defaultDelay;

      if (this.linesSubs != null) {
        this.linesSubs.dispose();
      }

      this.views = atom.views.getView(this.editor);
      this.lines = this.views.querySelector('.lines');
      this.linesSubs = new SubAtom();
      this.linesSubs.add(this.lines, 'mousedown', (event) =>
        this.mousedown(event)
      );

      return this.linesSubs.add(this.lines, 'mousemove', (event) => {
        if (this.mouseIsDown && this.canDrag && event.which > 0) {
          return this.drag();
        }

        return this.clear();
      });
    });
  }

  mousedown(event) {
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
      .forEach((elem) => {
        const { left, top, right, bottom } = elem.getBoundingClientRect();
        if (
          left <= event.pageX &&
          event.pageX < right &&
          top <= event.pageY &&
          event.pageY < bottom
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

    this.views.classList.add('simple-drag-drop-text--isDragging');

    if (event[atom.config.get('simple-drag-drop-text.copyKey') + 'Key']) {
      this.views.classList.add(isCopyingClassName);
    }

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

    this.views.classList.remove(
      'simple-drag-drop-text--isDragging',
      'simple-drag-drop-text--isDraggingAndCopying'
    );

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
