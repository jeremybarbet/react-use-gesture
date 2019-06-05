import CoordinatesRecognizer from './CoordinatesRecognizer'
import { noop, getPointerEventData } from '../utils'
import GestureController from '../controllers/GestureController'
import { TransformedEvent, GestureFlag, ReactEventHandlerKey, ReactEventHandlers } from '../../types/events.d'
import { Fn } from '../../types/common.d'
import { genericEndState } from '../defaults'

const preview = new Image()
// Transparent pixel.
preview.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

export default class DndRecognizer extends CoordinatesRecognizer {
  constructor(controller: GestureController<ReactEventHandlers | Fn>, args: any[]) {
    super('dnd', controller, args)
  }

  onStart = (event: TransformedEvent): void => {
    if (!this.isEnabled()) return
    const { values, ...rest } = getPointerEventData(event)
    // making sure we're not dragging the element when more than one finger press the screen
    if (rest.touches > 1) return
    ;(<any>event).dataTransfer.setData('text', '...')
    ;(<any>event).dataTransfer.setDragImage(preview, 1, 1)

    const startState = this.getStartState(values, event)

    this.updateState({ ...rest, dragging: true, down: true }, { ...startState, cancel: () => this.onCancel(event) }, GestureFlag.OnStart)
  }

  onChange = (event: TransformedEvent): void => {
    const { canceled, active } = this.getState()
    if (canceled || !active) return

    const { values, ...rest } = getPointerEventData(event)

    if (rest.buttons === 0 && rest.touches === 0) {
      this.onEnd(event)
      return
    }

    const kinematics = this.getKinematics(values, event)
    const cancel = () => this.onCancel(event)

    this.updateState(rest, { ...kinematics, first: false, cancel }, GestureFlag.OnChange)
  }

  onEnd = (event: TransformedEvent): void => {
    const state = this.getState()
    if (!state.active) return

    const { currentTarget, pointerId } = state
    if (currentTarget && this.pointerEventsEnabled()) (currentTarget as any).releasePointerCapture(pointerId)
    else this.removeWindowListeners()

    this.updateState({ dragging: false, down: false, buttons: 0, touches: 0 }, { ...genericEndState, event }, GestureFlag.OnEnd)
  }

  onCancel = (event: TransformedEvent): void => {
    this.updateState(null, { canceled: true, cancel: noop })
    requestAnimationFrame(() => this.onEnd(event))
  }

  getEventBindings(): [ReactEventHandlerKey | ReactEventHandlerKey[], Fn][] {
    return [['onDragStart', this.onStart], ['onDrag', this.onChange], ['onDragEnd', this.onEnd]]
  }
}
