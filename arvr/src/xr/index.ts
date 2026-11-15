// Public surface of the 3D/XR module for the app.
import './bvh' // fast raycasts for XR pointers (patches three's Mesh.raycast once)
export { useXRApp } from './store'
export { ASK_GUIDE_EVENT, BACK_TO_SOURCE_EVENT, askGuide, onAskGuide } from './events'
export { loadBodyContent, useBodyContent } from './content'
export type { BodyContent, GuideRequest, Hotspot, HotspotKind, ViewMode } from './types'
