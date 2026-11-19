import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js"
import {
  CSS2DObject,
  CSS2DRenderer,
} from "three/examples/jsm/renderers/CSS2DRenderer.js"

import { OTAK_ID } from "@/features/agents/agent-meta"
import {
  agentStatus,
  type AgentStatusKey,
} from "@/features/agents/agent-status"
import type { Agent } from "@/lib/api"

/*
 * Ruang kontrol Kantor Agent.
 * - Lantai = denah kantor: 6 ruang agent + Ruang Kendali di depan (Otak).
 * - Mata robot satu-satunya yang menyala; warnanya = status.
 * - Saat ada percakapan asli (Otak memberi tugas, agent melapor), bola
 *   cahaya berjalan melengkung dari pengirim ke penerima dan gelembung bicara
 *   muncul di atas robot. Isinya selalu dari kejadian asli.
 * - Gerakan (naik-turun, bola cahaya) mati kalau pengguna memilih mengurangi
 *   gerakan; bola cahaya diganti garis diam sesaat.
 */

const ROOMS = [
  { id: "maintenance", name: "Ruang Maintenance" },
  { id: "review", name: "Ruang Review" },
  { id: "studio", name: "Studio Denah" },
  { id: "rab", name: "Ruang RAB" },
  { id: "dokumen", name: "Ruang Dokumen" },
  { id: "lab", name: "Lab Developer" },
] as const

const ROOM_W = 6
const ROOM_D = 5
const GAP = 0.3
const KENDALI_W = 8
const KENDALI_D = 3.6
// Tepi depan baris ruang kedua, lalu celah, lalu Ruang Kendali.
const ROWS_EDGE_Z = (ROOM_D + GAP) / 2 + ROOM_D / 2
// Jarak lebih lebar supaya label Otak tidak menimpa nama ruang di belakangnya.
const KENDALI_Z = ROWS_EDGE_Z + 1.4 + KENDALI_D / 2
// Batas lantai untuk menghitung kamera.
const FLOOR_MIN_Z = -ROWS_EDGE_Z
const FLOOR_MAX_Z = KENDALI_Z + KENDALI_D / 2
const FLOOR_CENTER_Z = (FLOOR_MIN_Z + FLOOR_MAX_Z) / 2

const EYE: Record<
  AgentStatusKey,
  { color: string; intensity: number; light: number }
> = {
  siaga: { color: "#6b7d8f", intensity: 0.6, light: 0 },
  bekerja: { color: "#f2a93b", intensity: 2.2, light: 6 },
  menunggu: { color: "#ff3b45", intensity: 2.6, light: 8 },
  nonaktif: { color: "#1c2733", intensity: 0, light: 0 },
  gagal: { color: "#6b7d8f", intensity: 0.6, light: 0 },
}

const BEAM_COLOR = { tugas: "#ff3b45", laporan: "#e8edf2" } as const
const BUBBLE_MS = 6500

type RobotParts = {
  group: THREE.Group
  body: THREE.MeshStandardMaterial
  eyes: THREE.MeshStandardMaterial
  light: THREE.PointLight
  label: HTMLDivElement
  bubble: HTMLDivElement
  bubbleTimer: number
  baseY: number
  phase: number
  status: AgentStatusKey
}

export type SceneHandle = {
  /** Gelembung bicara di atas robot. */
  say: (
    agentId: string,
    text: string,
    kind: "tugas" | "laporan" | "langkah" | "jawaban"
  ) => void
  /** Bola cahaya dari satu robot ke robot lain. */
  beam: (from: string, to: string, kind: "tugas" | "laporan") => void
  resetView: () => void
}

function roomCenter(index: number) {
  const col = index % 3
  const row = Math.floor(index / 3)
  return new THREE.Vector3(
    (col - 1) * (ROOM_W + GAP),
    0,
    (row - 0.5) * (ROOM_D + GAP)
  )
}

function buildRobot(isOtak: boolean) {
  const group = new THREE.Group()
  const body = new THREE.MeshStandardMaterial({
    color: "#8a9cc4",
    metalness: 0.55,
    roughness: 0.32,
  })
  const screen = new THREE.MeshStandardMaterial({
    color: "#0a1018",
    metalness: 0.2,
    roughness: 0.6,
  })
  const eyes = new THREE.MeshStandardMaterial({
    color: "#1c2733",
    emissive: "#000000",
  })

  // Kepala kotak membulat, seperti robot kubus di referensi.
  const head = new THREE.Mesh(
    new RoundedBoxGeometry(1.5, 1.25, 1.25, 4, 0.22),
    body
  )
  head.position.y = 1.05
  group.add(head)
  const face = new THREE.Mesh(
    new RoundedBoxGeometry(1.15, 0.8, 0.08, 2, 0.06),
    screen
  )
  face.position.set(0, 1.08, 0.62)
  group.add(face)
  for (const x of [-0.26, 0.26]) {
    const eye = new THREE.Mesh(
      new RoundedBoxGeometry(0.3, 0.24, 0.06, 2, 0.05),
      eyes
    )
    eye.position.set(x, 1.13, 0.67)
    group.add(eye)
  }
  for (const x of [-0.8, 0.8]) {
    const bolt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.12, 16),
      body
    )
    bolt.rotation.z = Math.PI / 2
    bolt.position.set(x, 1.05, 0)
    group.add(bolt)
  }
  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8),
    body
  )
  antenna.position.set(0, 1.82, 0)
  group.add(antenna)
  // Otak punya ujung antena yang ikut menyala, penanda koordinator.
  if (isOtak) {
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), eyes)
    tip.position.set(0, 2.02, 0)
    group.add(tip)
  }
  for (const x of [-0.38, 0.38]) {
    const foot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.24, 0.32, 16),
      body
    )
    foot.position.set(x, 0.16, 0.05)
    group.add(foot)
  }
  const light = new THREE.PointLight("#ff3b45", 0, 4, 2)
  light.position.set(0, 1.1, 1.1)
  group.add(light)
  return { group, body, eyes, light }
}

function applyStatus(
  robot: RobotParts,
  status: AgentStatusKey,
  name: string,
  label: string
) {
  robot.status = status
  const eye = EYE[status]
  robot.eyes.color.set(status === "nonaktif" ? "#1c2733" : "#ffffff")
  robot.eyes.emissive.set(eye.color)
  robot.eyes.emissiveIntensity = eye.intensity
  robot.light.color.set(eye.color)
  robot.light.intensity = eye.light
  robot.body.color.set(status === "nonaktif" ? "#3c4a5c" : "#8a9cc4")
  // Robot yang belum aktif sedikit miring, seperti sedang dimatikan.
  robot.group.rotation.z = status === "nonaktif" ? 0.12 : 0
  robot.label.textContent = name
  robot.label.setAttribute("data-status", status)
  robot.label.title = `${name}: ${label}`
}

type SceneApi = SceneHandle & {
  applyView: () => void
  robots: Map<string, RobotParts>
  ring: THREE.Mesh
  render: () => void
  syncLoop: () => void
  addRobot: (id: string) => RobotParts
}

type KantorSceneProps = {
  ref?: Ref<SceneHandle>
  agents: Agent[]
  busy: string[]
  selectedId: string
  onSelect: (agentId: string) => void
  /** Tinggi (px) elemen yang menutupi bagian bawah panggung, misal bilah perintah. */
  bottomInset?: number
  className?: string
}

function KantorScene({
  ref,
  agents,
  busy,
  selectedId,
  onSelect,
  bottomInset = 0,
  className,
}: KantorSceneProps) {
  const container = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<SceneApi | null>(null)
  const insetRef = useRef(bottomInset)
  const onSelectRef = useRef(onSelect)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    onSelectRef.current = onSelect
  })

  useImperativeHandle(ref, () => ({
    say: (...args) => sceneRef.current?.say(...args),
    beam: (...args) => sceneRef.current?.beam(...args),
    resetView: () => sceneRef.current?.resetView(),
  }))

  // Scene dibuat sekali; status dan pilihan diperbarui lewat efek di bawah.
  useEffect(() => {
    const host = container.current
    if (!host) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true })
    } catch {
      queueMicrotask(() => setFailed(true))
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(host.clientWidth, host.clientHeight)
    // Deskripsi untuk pembaca layar ada di elemen pembungkus (aria-label).
    renderer.domElement.setAttribute("aria-hidden", "true")
    host.appendChild(renderer.domElement)

    const labels = new CSS2DRenderer()
    labels.setSize(host.clientWidth, host.clientHeight)
    labels.domElement.style.position = "absolute"
    labels.domElement.style.inset = "0"
    labels.domElement.style.pointerEvents = "none"
    labels.domElement.setAttribute("aria-hidden", "true")
    host.appendChild(labels.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color("#0f1922")
    scene.fog = new THREE.Fog("#0f1922", 40, 75)
    scene.add(new THREE.HemisphereLight("#9fb4d6", "#0b121a", 0.9))
    const key = new THREE.DirectionalLight("#ffffff", 1.4)
    key.position.set(-6, 12, 9)
    scene.add(key)
    const rim = new THREE.DirectionalLight("#6f8fd1", 0.7)
    rim.position.set(8, 6, -10)
    scene.add(rim)

    // Lantai: pelat per ruang; celah di antaranya terbaca sebagai dinding denah.
    const plateMaterial = new THREE.MeshStandardMaterial({
      color: "#14212e",
      roughness: 0.9,
    })
    const kendaliMaterial = new THREE.MeshStandardMaterial({
      color: "#182838",
      roughness: 0.85,
    })
    const edgeMaterial = new THREE.LineBasicMaterial({ color: "#33475b" })
    const addPlate = (
      center: THREE.Vector3,
      w: number,
      d: number,
      material: THREE.Material,
      name: string
    ) => {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), material)
      plate.position.copy(center).setY(-0.06)
      plate.add(
        new THREE.LineSegments(
          new THREE.EdgesGeometry(plate.geometry),
          edgeMaterial
        )
      )
      scene.add(plate)
      const roomLabel = document.createElement("div")
      roomLabel.className = "kantor-room-label"
      roomLabel.textContent = name
      const roomTag = new CSS2DObject(roomLabel)
      roomTag.position
        .copy(center)
        .add(new THREE.Vector3(-w / 2 + 0.3, 0.05, d / 2 - 0.25))
      roomTag.center.set(0, 1)
      scene.add(roomTag)
    }
    ROOMS.forEach((room, index) =>
      addPlate(roomCenter(index), ROOM_W, ROOM_D, plateMaterial, room.name)
    )
    addPlate(
      new THREE.Vector3(0, 0, KENDALI_Z),
      KENDALI_W,
      KENDALI_D,
      kendaliMaterial,
      "Ruang Kendali"
    )

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.35, 1.52, 48),
      new THREE.MeshBasicMaterial({ color: "#e6000b", side: THREE.DoubleSide })
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.02
    scene.add(ring)

    const robots = new Map<string, RobotParts>()
    const clickable: THREE.Object3D[] = []

    const camera = new THREE.PerspectiveCamera(
      32,
      host.clientWidth / host.clientHeight,
      0.1,
      200
    )
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enablePan = false
    controls.minPolarAngle = 0.35
    controls.maxPolarAngle = 1.15
    // Putaran kiri-kanan dibatasi sekitar 45 derajat supaya denah tetap terbaca.
    controls.minAzimuthAngle = -0.8
    controls.maxAzimuthAngle = 0.8
    controls.minDistance = 9
    controls.maxDistance = 70
    controls.target.set(0, 0, FLOOR_CENTER_Z)

    function placeCamera() {
      // Jarak kamera dihitung supaya seluruh lantai masuk ke layar, berapa pun
      // rasionya. Tepi depan lebih dekat ke kamera sehingga tampak lebih lebar.
      controls.target.set(0, 0, FLOOR_CENTER_Z)
      const floorWidth = 3 * ROOM_W + 2 * GAP + 0.6
      const floorDepth = FLOOR_MAX_Z - FLOOR_MIN_Z + 2.4
      const vHalf = THREE.MathUtils.degToRad(camera.fov / 2)
      const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect)
      const distance = Math.max(
        (floorWidth / 2 / Math.tan(hHalf)) * 1.18,
        floorDepth / 2 / Math.tan(vHalf)
      )
      const direction = new THREE.Vector3(0, 15, 11).normalize()
      camera.position.copy(controls.target).addScaledVector(direction, distance)
      controls.update()
    }

    const render = () => {
      renderer.render(scene, camera)
      labels.render(scene, camera)
    }
    controls.addEventListener("change", render)

    // Animasi berjalan hanya selama ada robot bekerja atau bola cahaya terbang.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const animations = new Set<(time: number) => boolean>()
    let frame = 0
    const tick = (time: number) => {
      for (const robot of robots.values()) {
        robot.group.position.y =
          robot.status === "bekerja" && !reduceMotion.matches
            ? robot.baseY + Math.sin(time / 380 + robot.phase) * 0.12
            : robot.baseY
      }
      for (const step of [...animations])
        if (step(time)) animations.delete(step)
      render()
      frame = shouldAnimate() ? requestAnimationFrame(tick) : 0
      if (!frame) render()
    }
    const shouldAnimate = () =>
      animations.size > 0 ||
      (!reduceMotion.matches &&
        [...robots.values()].some((robot) => robot.status === "bekerja"))
    const syncLoop = () => {
      if (shouldAnimate() && !frame) frame = requestAnimationFrame(tick)
      if (!shouldAnimate()) {
        for (const robot of robots.values())
          robot.group.position.y = robot.baseY
        render()
      }
    }
    reduceMotion.addEventListener("change", syncLoop)

    const headOf = (id: string) => {
      const robot = robots.get(id)
      if (!robot) return null
      const point = new THREE.Vector3(0, 1.6, 0)
      return robot.group.localToWorld(point)
    }

    const beam = (from: string, to: string, kind: "tugas" | "laporan") => {
      const start = headOf(from)
      const end = headOf(to)
      if (!start || !end) return
      const mid = start.clone().lerp(end, 0.5)
      mid.y += 3 + start.distanceTo(end) * 0.15
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end)
      const color = BEAM_COLOR[kind]
      const lineMaterial = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.55,
      })
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)),
        lineMaterial
      )
      scene.add(line)
      const orbMaterial = new THREE.MeshBasicMaterial({ color })
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 16, 12),
        orbMaterial
      )
      const orbLight = new THREE.PointLight(color, 4, 3, 2)
      orb.add(orbLight)
      if (!reduceMotion.matches) scene.add(orb)
      const started = performance.now()
      const travel = reduceMotion.matches ? 0 : 1100
      const fade = 700
      animations.add((time) => {
        const elapsed = time - started
        if (elapsed <= travel) {
          orb.position.copy(curve.getPoint(Math.max(0, elapsed / travel)))
          return false
        }
        scene.remove(orb)
        // Garis diam sebentar lalu memudar (tanpa gerakan saat reduced motion).
        const fadeElapsed = elapsed - travel - (reduceMotion.matches ? 900 : 0)
        lineMaterial.opacity =
          0.55 * (1 - Math.min(1, Math.max(0, fadeElapsed) / fade))
        if (fadeElapsed < fade) return false
        scene.remove(line)
        line.geometry.dispose()
        lineMaterial.dispose()
        orb.geometry.dispose()
        orbMaterial.dispose()
        return true
      })
      syncLoop()
    }

    const say: SceneHandle["say"] = (agentId, text, kind) => {
      const robot = robots.get(agentId)
      if (!robot) return
      const clean = text.replace(/\s+/g, " ").trim()
      robot.bubble.textContent =
        clean.length > 72 ? `${clean.slice(0, 70)}...` : clean
      robot.bubble.setAttribute("data-kind", kind)
      robot.bubble.setAttribute("data-show", "true")
      window.clearTimeout(robot.bubbleTimer)
      robot.bubbleTimer = window.setTimeout(() => {
        robot.bubble.setAttribute("data-show", "false")
        render()
      }, BUBBLE_MS)
      render()
    }

    // Klik robot = pilih agent. Seretan (memutar kamera) tidak dihitung klik.
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const pick = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      )
      raycaster.setFromCamera(pointer, camera)
      let hit: THREE.Object3D | null =
        raycaster.intersectObjects(clickable, true)[0]?.object ?? null
      while (hit && !hit.userData.agentId) hit = hit.parent
      return (hit?.userData.agentId as string | undefined) ?? null
    }
    let downAt: { x: number; y: number } | null = null
    const onDown = (event: PointerEvent) =>
      (downAt = { x: event.clientX, y: event.clientY })
    const onUp = (event: PointerEvent) => {
      if (
        !downAt ||
        Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 5
      )
        return
      const id = pick(event)
      if (id) onSelectRef.current(id)
    }
    const onMove = (event: PointerEvent) => {
      renderer.domElement.style.cursor = pick(event) ? "pointer" : "grab"
    }
    renderer.domElement.addEventListener("pointerdown", onDown)
    renderer.domElement.addEventListener("pointerup", onUp)
    renderer.domElement.addEventListener("pointermove", onMove)

    // Bagian bawah panggung tertutup bilah perintah. Kamera dihitung untuk area
    // yang terlihat saja (tinggi dikurangi inset), lalu setViewOffset
    // memperpanjang gambar ke bawah kanvas supaya lantai berada di tengah area
    // yang tidak tertutup.
    const applyView = () => {
      const w = host.clientWidth
      const h = host.clientHeight
      if (!w || !h) return
      const visible = Math.max(h * 0.5, h - insetRef.current)
      renderer.setSize(w, h)
      labels.setSize(w, h)
      camera.aspect = w / visible
      camera.setViewOffset(w, visible, 0, 0, w, h)
      camera.updateProjectionMatrix()
      host.setAttribute("data-narrow", String(w < 560))
      placeCamera()
      render()
    }
    const resize = new ResizeObserver(applyView)
    resize.observe(host)

    const addRobot = (id: string) => {
      const isOtak = id === OTAK_ID
      const parts = buildRobot(isOtak)
      parts.group.userData.agentId = id
      const labelEl = document.createElement("div")
      labelEl.className = "kantor-robot-label"
      const tag = new CSS2DObject(labelEl)
      tag.position.set(0, 2.3, 0)
      parts.group.add(tag)
      const bubbleEl = document.createElement("div")
      bubbleEl.className = "kantor-bubble"
      bubbleEl.setAttribute("data-show", "false")
      const bubbleTag = new CSS2DObject(bubbleEl)
      bubbleTag.position.set(0, 3.05, 0)
      bubbleTag.center.set(0.5, 1)
      parts.group.add(bubbleTag)
      scene.add(parts.group)
      clickable.push(parts.group)
      const robot: RobotParts = {
        ...parts,
        label: labelEl,
        bubble: bubbleEl,
        bubbleTimer: 0,
        baseY: 0,
        phase: Math.random() * Math.PI * 2,
        status: "siaga",
      }
      robots.set(id, robot)
      return robot
    }

    sceneRef.current = {
      applyView,
      robots,
      ring,
      render,
      syncLoop,
      addRobot,
      say,
      beam,
      resetView: () => (placeCamera(), render()),
    }

    placeCamera()
    render()

    return () => {
      cancelAnimationFrame(frame)
      reduceMotion.removeEventListener("change", syncLoop)
      resize.disconnect()
      controls.dispose()
      for (const robot of robots.values())
        window.clearTimeout(robot.bubbleTimer)
      renderer.domElement.removeEventListener("pointerdown", onDown)
      renderer.domElement.removeEventListener("pointerup", onUp)
      renderer.domElement.removeEventListener("pointermove", onMove)
      scene.traverse((object) => {
        if (
          object instanceof THREE.Mesh ||
          object instanceof THREE.LineSegments ||
          object instanceof THREE.Line
        ) {
          object.geometry.dispose()
          const material = object.material as THREE.Material | THREE.Material[]
          for (const item of Array.isArray(material) ? material : [material])
            item.dispose()
        }
      })
      renderer.dispose()
      renderer.domElement.remove()
      labels.domElement.remove()
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    insetRef.current = bottomInset
    sceneRef.current?.applyView()
  }, [bottomInset])

  // Status agent berubah tiap polling atau dari aliran langsung: perbarui warna
  // mata tanpa membangun ulang scene.
  useEffect(() => {
    const current = sceneRef.current
    if (!current) return
    const busySet = new Set(busy)
    const perRoom = new Map<string, Agent[]>()
    for (const agent of agents)
      perRoom.set(agent.room, [...(perRoom.get(agent.room) ?? []), agent])

    for (const [roomId, roomAgents] of perRoom) {
      const index = ROOMS.findIndex((room) => room.id === roomId)
      if (index < 0) continue
      const center = roomCenter(index)
      roomAgents.forEach((agent, i) => {
        const robot = current.robots.get(agent.id) ?? current.addRobot(agent.id)
        // Beberapa robot di satu ruang (Lab) dijajarkan dan sedikit diperkecil.
        const crowded = roomAgents.length > 1
        const spread = crowded ? (i - (roomAgents.length - 1) / 2) * 1.95 : 0
        robot.group.scale.setScalar(crowded ? 1.15 : 1.5)
        robot.group.position.set(center.x + spread, robot.baseY, center.z - 0.1)
        const status = agentStatus(agent)
        const live = busySet.has(agent.id) && agent.availability === "aktif"
        applyStatus(
          robot,
          live ? "bekerja" : status.key,
          agent.name,
          live ? "Sedang bekerja" : status.label
        )
      })
    }

    // Otak di Ruang Kendali, sedikit lebih besar dari agent lain.
    const otak = current.robots.get(OTAK_ID) ?? current.addRobot(OTAK_ID)
    otak.group.scale.setScalar(1.75)
    otak.group.position.set(0, otak.baseY, KENDALI_Z - 0.2)
    applyStatus(
      otak,
      busySet.has(OTAK_ID) ? "bekerja" : "siaga",
      "Otak Sparta",
      busySet.has(OTAK_ID) ? "Sedang bekerja" : "Siaga"
    )

    const selected = current.robots.get(selectedId)
    current.ring.visible = Boolean(selected)
    if (selected) {
      const scale = selected.group.scale.x / 1.5
      current.ring.scale.setScalar(scale)
      current.ring.position.set(
        selected.group.position.x,
        0.02,
        selected.group.position.z
      )
    }
    for (const [id, robot] of current.robots)
      robot.label.setAttribute("data-selected", String(id === selectedId))
    current.syncLoop()
    current.render()
  }, [agents, busy, selectedId])

  if (failed) {
    return (
      <p className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Browser ini tidak bisa menampilkan 3D (WebGL tidak aktif). Pakai daftar
        agent di panel untuk memilih agent.
      </p>
    )
  }

  const summary = agents
    .map((agent) => `${agent.name}: ${agentStatus(agent).label}`)
    .join(". ")

  return (
    <div
      ref={container}
      className={className ?? "relative h-full w-full overflow-hidden"}
      aria-label={`Ruang kontrol 3D. Otak Sparta di Ruang Kendali. ${summary}. Seret untuk memutar, klik robot untuk memilih agent.`}
      role="group"
    />
  )
}

export default KantorScene
