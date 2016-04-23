
###
  lib/simple-drag-drop-text.coffee
###

$ = require 'jquery'
SubAtom = require 'sub-atom'

class SimpleDragDropText
  config:
    copyKey:
      type: 'string'
      default: 'alt'
      description: 'Select key for copy action'
      enum: ['alt', 'ctrl', 'meta']

  activate: ->
    @subs = new SubAtom

    @subs.add 'body', 'mouseup', (e) => if @mouseIsDown then @clear e[atom.config.get('simple-drag-drop-text.copyKey')+'Key']
    @subs.add atom.workspace.observeTextEditors        (editor) => @setEditor()
    @subs.add atom.workspace.onDidChangeActivePaneItem (editor) => @setEditor()

  setEditor: ->
    process.nextTick =>
      if not (@editor = atom.workspace.getActiveTextEditor())
        @clear()
        return

      @linesSubs?.dispose()
      @lines = atom.views.getView(@editor)
      if @lines.shadowRoot
        @lines = @lines.shadowRoot.querySelector '.lines'
      else
        @lines = @lines.querySelector '.lines'
      @linesSubs = new SubAtom
      @linesSubs.add @lines, 'mousedown', (e) => @mousedown e
      @linesSubs.add @lines, 'mousemove', (e) =>
        if @mouseIsDown and e.which > 0 then @drag() else @clear()

  mousedown: (e) ->
    if not @editor then @clear(); return

    @selMarker = @editor.getLastSelection().marker
    @selBufferRange = @selMarker.getBufferRange()
    if @selBufferRange.isEmpty() then return

    inSelection = no
    $(@lines).find('.highlights .highlight.selection .region').each (__, ele) =>
      {left, top, right, bottom} = ele.getBoundingClientRect()
      if left <= e.pageX < right and
          top <= e.pageY < bottom
        inSelection = yes
        return false
    if not inSelection then return

    @text = @editor.getTextInBufferRange @selBufferRange
    @marker = @editor.markBufferRange @selBufferRange, @selMarker.getProperties()
    @editor.decorateMarker @marker, type: 'highlight', class: 'selection'

    @mouseIsDown = yes

  drag: ->
    @isDragging = yes
    selection = @editor.getLastSelection()
    process.nextTick -> selection.clear()

  drop: (altKey) ->
    checkpointBefore = @editor.createCheckpoint()
    if not altKey then @editor.setTextInBufferRange @selBufferRange, ''
    cursorPos = @editor.getLastSelection().marker.getBufferRange().start
    @editor.setTextInBufferRange [cursorPos, cursorPos], @text
    @editor.groupChangesSinceCheckpoint checkpointBefore

  clear: (altKey) ->
    if altKey? and @isDragging then @drop altKey
    @mouseIsDown = @isDragging = no
    @marker?.destroy()

  deactivate: ->
    @clear()
    @linesSubs?.dispose()
    @subs.dispose()

module.exports = new SimpleDragDropText
