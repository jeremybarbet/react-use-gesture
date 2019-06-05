import { DistanceAngle, FullGestureState, Coordinates } from './states'

export type Handler<T extends Coordinates | DistanceAngle> = (state: FullGestureState<T>) => any
export type HandlerKey = 'onDrag' | 'onPinch' | 'onMove' | 'onHover' | 'onScroll' | 'onWheel' | 'onDnd'

export type GestureHandlers = {
  onAction: Handler<Coordinates>
  onDrag: Handler<Coordinates>
  onDragStart: Handler<Coordinates>
  onDragEnd: Handler<Coordinates>
  onDnd: Handler<Coordinates>
  onDndStart: Handler<Coordinates>
  onDndEnd: Handler<Coordinates>
  onHover: Handler<Coordinates>
  onMove: Handler<Coordinates>
  onMoveStart: Handler<Coordinates>
  onMoveEnd: Handler<Coordinates>
  onScroll: Handler<Coordinates>
  onScrollStart: Handler<Coordinates>
  onScrollEnd: Handler<Coordinates>
  onWheel: Handler<Coordinates>
  onWheelStart: Handler<Coordinates>
  onWheelEnd: Handler<Coordinates>
  onPinch: Handler<DistanceAngle>
  onPinchStart: Handler<DistanceAngle>
  onPinchEnd: Handler<DistanceAngle>
}
