/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

const { CompositeDisposable, Disposable } = require('atom');

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

  constructor() {
    this.subs = new CompositeDisposable();
    this.linesSubs = new CompositeDisposable();
  }

  activate() {
    this.setCanDragOff();
    const body = document.querySelector('body');
    const userEventKey = atom.config.get('simple-drag-drop-text.copyKey');
    const userKey = `${userEventKey}Key`;

    this.handleMouseUp = (event) => {
      if (this.getMouseIsDown()) {
        return this.clear(event[userKey]);
      }
    };

    this.handleKeyDown = (event) => {
      if (this.getMouseIsDown() && event[userKey]) {
        this.getView().classList.add(isCopyingClassName);
      }
    };

    this.handleKeyUp = (event) => {
      if (keys[userEventKey] === event.key) {
        this.getView().classList.remove(isCopyingClassName);
      }

      if ('Escape' === event.key) {
        this.clear();
      }
    };

    body.addEventListener('mouseup', this.handleMouseUp);
    this.subs.add(
      new Disposable(() => {
        body.removeEventListener('mouseup', this.handleMouseUp);
      })
    );

    body.addEventListener('keydown', this.handleKeyDown);
    this.subs.add(
      new Disposable(() => {
        body.removeEventListener('keydown', this.handleKeyDown);
      })
    );

    body.addEventListener('keyup', this.handleKeyUp);
    this.subs.add(
      new Disposable(() => {
        body.removeEventListener('keyup', this.handleKeyUp);
      })
    );

    this.subs.add(atom.workspace.observeTextEditors(() => this.setEditor()));

    return this.subs.add(
      atom.workspace.onDidChangeActivePaneItem(() => this.setEditor())
    );
  }

  getMouseIsDown() {
    return this.mouseIsDown;
  }

  setMouseIsDown() {
    this.mouseIsDown = true;

    return this.getMouseIsDown();
  }

  setMouseIsUp() {
    this.mouseIsDown = false;

    return this.getMouseIsDown();
  }

  getCanDrag() {
    return this.canDrag;
  }

  setCanDragOn() {
    this.canDrag = true;

    return this.getCanDrag();
  }

  setCanDragOff() {
    this.canDrag = false;

    return this.getCanDrag();
  }

  getIsDragging() {
    return this.isDragging;
  }

  setIsDraggingOn() {
    this.isDragging = true;

    return this.getIsDragging();
  }

  setIsDraggingOff() {
    this.isDragging = false;

    return this.getIsDragging();
  }

  getUserDelay() {
    return atom.config.get('simple-drag-drop-text.delay') || defaultDelay;
  }

  getView() {
    return this.views;
  }

  setView() {
    this.views = atom.views.getView(this.getEditor());

    return this.getView();
  }

  getEditor() {
    return this.editor;
  }

  setEditor() {
    return process.nextTick(() => {
      if (!(this.editor = atom.workspace.getActiveTextEditor())) {
        this.clear();

        return;
      }

      if (null !== this.linesSubs) {
        this.linesSubs.dispose();
      }

      this.setView();

      this.handleMouseDown = (event) => this.mousedown(event);

      this.handleMouseMove = (event) => {
        if (this.getMouseIsDown() && this.getCanDrag() && event.which > 0) {
          return this.drag();
        }

        return this.clear();
      };

      const lines = this.getView().querySelector('.lines');
      lines.addEventListener('mousedown', this.handleMouseDown);

      this.linesSubs.add(
        new Disposable(() => {
          lines.removeEventListener('mousedown', this.handleMouseDown);
        })
      );

      lines.addEventListener('mousemove', this.handleMouseMove);

      this.linesSubs.add(
        new Disposable(() => {
          lines.removeEventListener('mousemove', this.handleMouseMove);
        })
      );

      return;
    });
  }

  mousedown(event) {
    if (!this.getEditor()) {
      this.clear();
      return;
    }

    this.selMarker = this.getEditor().getLastSelection().marker;
    this.selBufferRange = this.selMarker.getBufferRange();

    if (this.selBufferRange.isEmpty()) {
      return;
    }

    let inSelection = false;

    this.highlights = this.getView().querySelector('.highlights');

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

    this.text = this.getEditor().getTextInBufferRange(this.selBufferRange);
    this.marker = this.getEditor().markBufferRange(
      this.selBufferRange,
      this.selMarker.getProperties()
    );
    this.getEditor().decorateMarker(this.marker, {
      type: 'highlight',
      class: 'selection',
    });

    this.setMouseIsDown();

    this.getView().classList.add('simple-drag-drop-text--isDragging');

    if (event[atom.config.get('simple-drag-drop-text.copyKey') + 'Key']) {
      this.getView().classList.add(isCopyingClassName);
    }

    return setTimeout(() => {
      return this.setCanDragOn();
    }, this.getUserDelay);
  }

  drag() {
    this.setIsDraggingOn();

    const selection = this.getEditor().getLastSelection();

    return process.nextTick(() => selection.clear());
  }

  drop(altKey) {
    const checkpointBefore = this.getEditor().createCheckpoint();

    if (!altKey) {
      this.getEditor().setTextInBufferRange(this.selBufferRange, '');
    }

    const cursorPos = this.getEditor()
      .getLastSelection()
      .marker.getBufferRange().start;

    this.getEditor().setTextInBufferRange([cursorPos, cursorPos], this.text);

    return this.getEditor().groupChangesSinceCheckpoint(checkpointBefore);
  }

  clear(altKey) {
    if (null !== altKey && this.getIsDragging()) {
      this.drop(altKey);
    }

    this.getView().classList.remove(
      'simple-drag-drop-text--isDragging',
      'simple-drag-drop-text--isDraggingAndCopying'
    );

    this.setIsDraggingOff();
    this.setCanDragOff();
    this.setMouseIsUp();

    return null !== this.marker && undefined !== this.marker
      ? this.marker.destroy()
      : undefined;
  }

  deactivate() {
    this.clear();

    if (null !== this.linesSubs) {
      this.linesSubs.dispose();
    }

    return this.subs.dispose();
  }
}

SimpleDragDropText.initClass();

module.exports = new SimpleDragDropText();
