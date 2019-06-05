import { noop } from './utils'
import { GestureConfig } from '../types/config.d'
import { CommonGestureState, Coordinates, DistanceAngle, StateObject, StateKey, GestureKey } from '../types/states.d'
import { HandlerKey } from '../types/web.d'

type MappedKeys = { [K in GestureKey]: { stateKey: StateKey; handlerKey: HandlerKey } }

/**
 * Some gestures might use the state key from another gesture (i.e. hover)
 * so mappedKeys is a commodity object to get the state key and handler key
 * for every gesture
 */
export const mappedKeys: MappedKeys = {
  drag: { stateKey: 'drag', handlerKey: 'onDrag' },
  pinch: { stateKey: 'pinch', handlerKey: 'onPinch' },
  move: { stateKey: 'move', handlerKey: 'onMove' },
  scroll: { stateKey: 'scroll', handlerKey: 'onScroll' },
  wheel: { stateKey: 'wheel', handlerKey: 'onWheel' },
  hover: { stateKey: 'move', handlerKey: 'onHover' },
  dnd: { stateKey: 'drag', handlerKey: 'onDnd' },
}

// default config (will extend user config)
export const defaultConfig: GestureConfig = {
  domTarget: undefined,
  event: { passive: true, capture: false },
  pointerEvents: false,
  window: typeof window !== 'undefined' ? window : undefined,
  transform: { x: (x: number): number => x, y: (y: number): number => y },
  enabled: true,
  drag: true,
  dnd: true,
  pinch: true,
  scroll: true,
  wheel: true,
  hover: true,
  move: true,
}

// common initial state for all gestures
export const initialCommon: CommonGestureState = {
  event: undefined,
  currentTarget: undefined,
  pointerId: undefined,
  values: [0, 0],
  velocities: [0, 0],
  delta: [0, 0],
  initial: [0, 0],
  previous: [0, 0],
  transform: undefined,
  local: [0, 0],
  lastLocal: [0, 0],
  first: false,
  last: false,
  active: false,
  time: undefined,
  cancel: noop,
  canceled: false,
  temp: undefined,
  args: undefined,
}

// initial state for coordinates-based gestures
const initialCoordinates: Coordinates = { xy: [0, 0], vxvy: [0, 0], velocity: 0, distance: 0, direction: [0, 0] } // xy coordinates

// initial state for distance and angle-based gestures (pinch)
const initialDistanceAngle: DistanceAngle = { da: [0, 0], vdva: [0, 0], origin: [0, 0], turns: 0 } // distance and angle

// initial state object (used by the gesture controller)
export const initialState: StateObject = {
  shared: {
    hovering: false,
    scrolling: false,
    wheeling: false,
    dragging: false,
    moving: false,
    pinching: false,
    touches: 0,
    buttons: 0,
    down: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    ctrlKey: false,
  },
  move: { ...initialCommon, ...initialCoordinates },
  drag: { ...initialCommon, ...initialCoordinates },
  scroll: { ...initialCommon, ...initialCoordinates },
  wheel: { ...initialCommon, ...initialCoordinates },
  pinch: { ...initialCommon, ...initialDistanceAngle },
}

// generic end state for all gestures
export const genericEndState = { first: false, last: true, active: false }
