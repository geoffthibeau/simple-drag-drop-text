
###
  lib/simple-drag-drop-text.coffee
###

$ = require 'jquery'
SubAtom = require 'sub-atom'

class SimpleDragDropText
  config:    
    mouseHoldDelay:
      title: 'Hold time before dragging (MS)'
      type:'integer'
      default: 400
      
  activate: ->
    console.log 'activate'
    @subs = new SubAtom
      
    @subs.add 'body', 'mouseup', (e) => if @active then @clear e.altKey
    @subs.add atom.workspace.observeTextEditors        (editor) => @setEditor editor
    @subs.add atom.workspace.onDidChangeActivePaneItem (editor) => @setEditor editor
  
  setEditor: (@editor) ->
    console.log 'setEditor', @editor?
    @linesSubs?.dispose()
    if not @editor then return
    
    activeEditor = atom.workspace.getActiveTextEditor() 
    if @editor isnt activeEditor 
      console.log 'not active editor', @editor, activeEditor
      @clear()
      return
    console.log 'is active editor'
    
    @lines = atom.views.getView(@editor).shadowRoot.querySelector '.lines'
    @linesSubs = new SubAtom
    @linesSubs.add @lines, 'mousedown', (e) => @mousedown e
    @linesSubs.add @lines, 'mousemove', (e) => if @selected then @drag() else @clear()
        
  mousedown: (e) ->
    console.log 'mousedown', @editor, @lines
    @selMarker = @editor.getLastSelection().marker
    @selBufferRange = @selMarker.getBufferRange()
    if @selBufferRange.isEmpty() then return
    
    @text = @editor.getTextInBufferRange @selBufferRange
    @marker = @editor.markBufferRange @selBufferRange, @selMarker.getProperties()
    @editor.decorateMarker @marker, type: 'highlight', class: 'selection'

    @active = yes
    @mouseTimeout = setTimeout =>
      @mouseTimeout = null
    
      inSelection = no
      $(@lines).find('.highlights .highlight.selection .region').each (__, ele) =>
        {left, top, right, bottom} = ele.getBoundingClientRect()
        if left <= e.pageX < right and
            top <= e.pageY < bottom
          inSelection = yes
          return false
      if not inSelection then @clear(); return
    
      @selected = yes
      @editor.decorateMarker @marker, type: 'highlight', class: 'drag-drop-text-selected'
    , atom.config.get 'simple-drag-drop-text.mouseHoldDelay'

  drag: ->
    @isDragging = yes
    selection = @editor.getLastSelection()
    process.nextTick -> selection.clear()
  
  drop: (altKey) ->
    if not altKey then @editor.setTextInBufferRange @selBufferRange, ''
    cursorPos = @editor.getLastSelection().marker.bufferMarker.range.start
    @editor.setTextInBufferRange [cursorPos, cursorPos], @text
    
  clear: (altKey) -> 
    if altKey? and @isDragging then @drop altKey
    if @mouseTimeout 
      clearTimeout @mouseTimeout
      @mouseTimeout = null
    @active = @selected = @isDragging = no
    @marker?.destroy()
    
  deactivate: ->
    @clear()
    @linesSubs?.dispose()
    @subs.dispose()

module.exports = new SimpleDragDropText
