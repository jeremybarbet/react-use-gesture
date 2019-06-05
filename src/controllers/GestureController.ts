import {
  Coordinates,
  DistanceAngle,
  StateKey,
  StateObject,
  GestureState,
  SharedGestureState,
  GestureKey,
  FullGestureState,
} from '../../types/states.d'
import { Fn, AtLeastOneOf } from '../../types/common.d'
import { ReactEventHandlerKey, GestureFlag, ReactEventHandlers } from '../../types/events.d'
import { GestureHandlers, Handler, HandlerKey } from '../../types/web.d'
import { GestureConfig } from '../../types/config.d'

import { defaultConfig, initialState, mappedKeys } from '../defaults'
import { addListeners, removeListeners, supportsGestureEvent, chainFns } from '../utils'

import DragRecognizer from '../recognizers/DragRecognizer'
import DndRecognizer from '../recognizers/DndRecognizer'
import ScrollRecognizer from '../recognizers/ScrollRecognizer'
import WheelRecognizer from '../recognizers/WheelRecognizer'
import MoveRecognizer from '../recognizers/MoveRecognizer'
import HoverRecognizer from '../recognizers/HoverRecognizer'
import PinchRecognizer from '../recognizers/PinchRecognizer'
import PinchWheelRecognizer from '../recognizers/PinchWheelRecognizer'
import PinchWebKitGestureRecognizer from '../recognizers/PinchWebKitGestureRecognizer'
import CoordinatesRecognizer from '../recognizers/CoordinatesRecognizer'
import DistanceAngleRecognizer from '../recognizers/DistanceAngleRecognizer'

type GestureTimeouts = Partial<{ [stateKey in StateKey]: number }>
type WindowListeners = Partial<{ [stateKey in StateKey]: [string, Fn][] }>
type Bindings = Partial<{ [eventName in ReactEventHandlerKey]: Fn[] }>

/**
 * Gesture controller will create gesture recognizers (which handle the gesture logic)
 * and keep track of the state for all gestures
 *
 * @template BinderType the type the bind function should return
 */
export default class GestureController<BinderType extends ReactEventHandlers | Fn> {
  public handlers!: AtLeastOneOf<GestureHandlers> // keeping track of the handlers set in useGesture
  public config!: GestureConfig // keeping track of the config set in useGesture
  public state: StateObject = initialState // state for all gestures
  public timeouts: GestureTimeouts = {} // keeping track of timeouts for debounced gestures (such as move, scroll, wheel)
  private bindings: Bindings = {} // an object holding the handlers associated to the gestures
  private domListeners: [string, Fn][] = [] // when config.domTarget is set, we attach events directly to the dom
  private windowListeners: WindowListeners = {} // keeps track of window listeners added by gestures (drag only at the moment)

  constructor(handlers: AtLeastOneOf<GestureHandlers> | Handler<Coordinates>, config?: Partial<GestureConfig>) {
    this.setHandlersAndConfig(handlers, config)
  }

  /**
   * Set handlers and config of gesture controller
   * Should be called every time handlers and config change in useGesture
   */
  public setHandlersAndConfig = (handlers: AtLeastOneOf<GestureHandlers> | Handler<Coordinates>, config?: Partial<GestureConfig>) => {
    if (typeof handlers === 'function') handlers = { onDrag: handlers } as GestureHandlers
    else if (handlers.onAction) {
      handlers.onDrag = handlers.onAction
    }
    this.config = { ...defaultConfig, ...config }
    const { domTarget } = this.config
    const realDomTarget = domTarget && 'current' in domTarget ? domTarget.current : domTarget
    this.config.domTarget = realDomTarget

    this.handlers = handlers
  }

  /**
   * Function run on component unmount
   * Cleans timeouts and removes dom listeners set by the bind function
   */
  public clean = (): void => {
    this.cleanOnBind()
    Object.values(this.timeouts).forEach(clearTimeout)
    Object.keys(this.windowListeners).forEach(stateKey => this.removeWindowListeners(<StateKey>stateKey))
  }

  /**
   * Function run every time the bind function is run (ie on every render)
   * Reset the binding object and remove dom listeners attached to config.domTarget
   */
  private cleanOnBind = (): void => {
    this.bindings = {}
    const { domTarget } = this.config
    if (domTarget) {
      removeListeners(<EventTarget>domTarget, this.domListeners, this.config.event)
      this.domListeners = []
    }
  }

  /**
   * Commodity function to let gesture recognizer update global state
   * @param sharedState shared partial state object
   * @param gestureState partial gesture specific state object
   * @param gestureKey the gesture key ('drag', 'move'...)
   * @param [gestureFlag] if set, will also fire the gesture handler set by the user
   */
  public updateState = (
    sharedState: Partial<SharedGestureState> | null,
    gestureState: Partial<GestureState<Coordinates | DistanceAngle>>,
    gestureKey: GestureKey,
    gestureFlag?: GestureFlag
  ): void => {
    const stateKey = mappedKeys[gestureKey].stateKey

    this.state = {
      ...this.state,
      shared: { ...this.state.shared, ...sharedState },
      [stateKey]: { ...this.state[stateKey], ...(gestureState as object) },
    }

    if (gestureFlag) {
      this.fireGestureHandler(gestureKey, gestureFlag)
    }
  }

  // fire the gesture handler defined by the user
  public fireGestureHandler = (gestureKey: GestureKey, gestureFlag: GestureFlag): void => {
    // gets the state key and handler key from the gesture key
    // gestureKey: 'hover' -> stateKey: 'move', handlerKey: 'onHover'
    const { stateKey, handlerKey } = mappedKeys[gestureKey]
    const state = { ...this.state.shared, ...this.state[stateKey] }

    if (gestureKey === 'pinch') {
      const pinchState = state as FullGestureState<DistanceAngle>
      pinchState.da = state.values // legacy state attribute for pinch gestures
      pinchState.vdva = state.velocities // legacy state attribute for pinch gestures
    } else {
      const coordinatesState = state as FullGestureState<Coordinates>
      coordinatesState.xy = state.values // legacy state attribute for xy gestures
      coordinatesState.vxvy = state.velocities // legacy state attribute for xy gestures
    }

    if (gestureFlag === GestureFlag.OnStart) {
      const handlerStart = `${handlerKey}Start` as keyof GestureHandlers
      const handler = this.handlers[handlerStart] as any
      handler && handler(state)
    }

    // whenever a flag is set, we run the default on[Gesture] function
    // i.e. GestureFlag.OnStart would trigger both onDragStart and onDrag
    const handler = this.handlers[handlerKey] as any
    if (handler) {
      this.state[stateKey].temp = handler(state) || this.state[stateKey].temp
    }

    if (gestureFlag === GestureFlag.OnEnd) {
      const handlerEnd = `${handlerKey}End` as keyof GestureHandlers
      const handler = this.handlers[handlerEnd] as any
      handler && handler(state)
    }
  }

  /**
   * Commodity function to let recognizers simply add listeners to config.window
   * @param stateKey
   * @param listeners
   */
  public addWindowListeners = (stateKey: StateKey, listeners: [string, Fn][]): void => {
    if (!this.config.window) return
    // we use this.windowListeners to keep track of the listeners we add
    this.windowListeners[stateKey] = listeners
    addListeners(this.config.window, listeners, this.config.event)
  }

  // commodity function to let recognizers simply remove listeners from config.window
  public removeWindowListeners = (stateKey: StateKey): void => {
    if (!this.config.window) return
    const listeners = this.windowListeners[stateKey]
    if (listeners) {
      removeListeners(this.config.window, listeners, this.config.event)
      delete this.windowListeners[stateKey]
    }
  }

  /**
   * Adds a recognizer to this.bindings
   * @param recognizer
   */
  private addRecognizer = (recognizer: CoordinatesRecognizer | DistanceAngleRecognizer): void => {
    recognizer.getEventBindings().map(this.addEventBindings)
  }

  /**
   * this.bindings is an object which keys match ReactEventHandlerKeys (onMouseMove, onTouchStart...).
   * Since a recognizer might want to bind a handler function to an event key already used by a previously
   * added recognizer, we need to make sure that each event key is an array of all the functions mapped for
   * that key.
   */
  private addEventBindings = ([eventNames, fn]: [ReactEventHandlerKey | ReactEventHandlerKey[], Fn]): void => {
    const eventNamesArray = !Array.isArray(eventNames) ? [eventNames] : eventNames

    eventNamesArray.forEach(eventName => {
      this.bindings[eventName] = this.bindings[eventName] ? [...(<Fn[]>this.bindings[eventName]), fn] : [fn]
    })
  }

  /**
   * When config.domTarget is set, this function will add dom listeners to it
   */
  private addDomTargetListeners = (): void => {
    const { domTarget } = this.config

    // we iterate on the entries of this.binding
    // for each event, we chain the array of functions mapped to it
    // and push it to this.domListeners
    Object.entries(this.bindings).forEach(([event, fns]) => {
      this.domListeners.push([event.substr(2).toLowerCase(), chainFns(...(<Fn[]>fns))])
    })

    addListeners(<EventTarget>domTarget, this.domListeners, this.config.event)
  }

  /**
   * getBindings will return an object that will be bound by users
   * to the react component they want to interact with
   */
  private getBindings = (): ReactEventHandlers => {
    const output: ReactEventHandlers & { draggable?: boolean } = {}
    const captureString = this.config.event.capture ? 'Capture' : ''

    Object.entries(this.bindings).forEach(([event, fns]) => {
      const key = (event + captureString) as ReactEventHandlerKey
      output[key] = chainFns(...(<Fn[]>fns))
    })

    if (this.handlers.onDnd) {
      output.draggable = true
    }

    return output
  }

  public bind = (...args: any[]): BinderType => {
    // if handlers contains {onDragStart, onDrag, onDragEnd, onMoveStart, onMove}
    // actions will skip on[Gesture]["Start"|"End"] functions and include
    // ['onDrag', 'onMove']
    const actions: Set<HandlerKey | undefined> = new Set(
      Object.keys(this.handlers)
        .filter(k => k.indexOf('on') === 0)
        .map(k => {
          const match = k.match(/(on[A-Z][a-z]+)/)
          if (match) return <HandlerKey>match[1]
        })
    )

    const { domTarget } = this.config

    // cleaning before adding
    this.cleanOnBind()

    if (actions.has('onDrag')) {
      this.addRecognizer(new DragRecognizer(this, args))
    }
    if (actions.has('onDnd')) {
      this.addRecognizer(new DndRecognizer(this, args))
    }
    if (actions.has('onScroll')) {
      this.addRecognizer(new ScrollRecognizer(this, args))
    }
    if (actions.has('onWheel')) {
      this.addRecognizer(new WheelRecognizer(this, args))
    }
    if (actions.has('onMove')) {
      this.addRecognizer(new MoveRecognizer(this, args))
    }
    if (actions.has('onHover')) {
      this.addRecognizer(new HoverRecognizer(this, args))
    }
    if (actions.has('onPinch')) {
      // since react doesn't have handlers for gesture events we can only use them
      // domTarget is set (and when the browser supprots them).
      if (domTarget && supportsGestureEvent()) {
        this.addRecognizer(new PinchWebKitGestureRecognizer(this, args))
      } else {
        this.addRecognizer(new PinchRecognizer(this, args))
        this.addRecognizer(new PinchWheelRecognizer(this, args))
      }
    }

    // if config.domTarget is set we add event listeners to it and return the clean function
    if (domTarget) {
      this.addDomTargetListeners()
      return this.clean as BinderType
    }

    // if not, we return an object that contains gesture handlers mapped to react handler event keys
    return this.getBindings() as BinderType
  }
}
