import { Box, Eye, EyeOff, Square } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

import { ErrorAlert } from "@/components/common/error-alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api, type DenahModel } from "@/lib/api"

// Dinding diangkat dengan tinggi dan tebal seragam. Angka ini sengaja
// ditampilkan di bawah viewer supaya tidak dikira ukuran asli bangunan.
const WALL_HEIGHT = 3
const WALL_THICKNESS = 0.15

type ViewerHandle = {
  setView: (view: "atas" | "perspektif") => void
  setOtherLines: (visible: boolean) => void
}

function buildScene(
  container: HTMLDivElement,
  model: DenahModel
): ViewerHandle & { dispose: () => void } {
  const width = container.clientWidth
  const height = container.clientHeight
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(width, height)
  container.appendChild(renderer.domElement)
  renderer.domElement.setAttribute("role", "img")
  renderer.domElement.setAttribute(
    "aria-label",
    `Model 3D denah ${model.sourceName}, ${model.width} kali ${model.depth} meter. Seret untuk memutar, scroll untuk zoom.`
  )

  const scene = new THREE.Scene()
  scene.background = new THREE.Color("#0f1922")
  scene.add(new THREE.HemisphereLight("#cfd9e6", "#0b121a", 1.8))
  const sun = new THREE.DirectionalLight("#ffffff", 1.6)
  sun.position.set(model.width * 0.3, 40, model.depth * 0.8)
  scene.add(sun)

  // Denah memakai (x, y); di 3D jadi (x, 0, -y) supaya utara tetap ke atas.
  const center = new THREE.Vector3(model.width / 2, 0, -model.depth / 2)

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(model.width + 2, model.depth + 2),
    new THREE.MeshStandardMaterial({ color: "#14212e" })
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.copy(center).setY(-0.01)
  scene.add(floor)

  const wallSet = new Set(model.wallLayers)
  const wallMaterial = new THREE.MeshStandardMaterial({ color: "#d9dce0" })
  const edgeMaterial = new THREE.LineBasicMaterial({ color: "#3a4047" })
  const walls = new THREE.Group()
  const otherPoints: number[] = []

  for (const [x1, y1, x2, y2, layerIndex] of model.segments) {
    const length = Math.hypot(x2 - x1, y2 - y1)
    if (length < 0.01) continue
    if (!wallSet.has(model.layers[layerIndex]?.name)) {
      otherPoints.push(x1, 0.01, -y1, x2, 0.01, -y2)
      continue
    }
    const geometry = new THREE.BoxGeometry(length, WALL_HEIGHT, WALL_THICKNESS)
    const wall = new THREE.Mesh(geometry, wallMaterial)
    wall.position.set((x1 + x2) / 2, WALL_HEIGHT / 2, -(y1 + y2) / 2)
    wall.rotation.y = Math.atan2(y2 - y1, x2 - x1)
    wall.add(
      new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edgeMaterial)
    )
    walls.add(wall)
  }
  scene.add(walls)

  const otherGeometry = new THREE.BufferGeometry()
  otherGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(otherPoints, 3)
  )
  const otherLines = new THREE.LineSegments(
    otherGeometry,
    new THREE.LineBasicMaterial({ color: "#8a9199" })
  )
  scene.add(otherLines)

  const span = Math.max(model.width, model.depth, 4)
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, span * 20)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.copy(center)

  // Render hanya saat kamera berubah, tidak ada animasi berjalan terus.
  const render = () => renderer.render(scene, camera)
  controls.addEventListener("change", render)

  function setView(view: "atas" | "perspektif") {
    // Layar sempit (HP) butuh kamera lebih jauh supaya seluruh denah masuk.
    const fit = Math.max(1, 1.3 / camera.aspect)
    if (view === "atas") {
      camera.position.set(center.x, span * 1.3 * fit, center.z + 0.001)
    } else {
      camera.position.set(
        center.x - span * 0.6 * fit,
        span * 0.7 * fit,
        center.z + span * 0.9 * fit
      )
    }
    controls.update()
    render()
  }

  const resize = new ResizeObserver(() => {
    const w = container.clientWidth
    const h = container.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    render()
  })
  resize.observe(container)

  setView("perspektif")

  return {
    setView,
    setOtherLines(visible) {
      otherLines.visible = visible
      render()
    },
    dispose() {
      resize.disconnect()
      controls.dispose()
      scene.traverse((object) => {
        if (
          object instanceof THREE.Mesh ||
          object instanceof THREE.LineSegments
        )
          object.geometry.dispose()
      })
      wallMaterial.dispose()
      edgeMaterial.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}

type DenahViewerProps = { modelId: string }

function DenahViewer({ modelId }: DenahViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<ViewerHandle | null>(null)
  const [state, setState] = useState<{
    id: string
    model?: DenahModel
    error?: string
  } | null>(null)
  const [showOther, setShowOther] = useState(true)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    api
      .denahModel(modelId)
      .then((model) => !cancelled && setState({ id: modelId, model }))
      .catch(
        (error: Error) =>
          !cancelled && setState({ id: modelId, error: error.message })
      )
    return () => {
      cancelled = true
    }
  }, [modelId, attempt])

  const model = state?.id === modelId ? state.model : undefined
  const error = state?.id === modelId ? state.error : undefined

  useEffect(() => {
    if (!model || !containerRef.current) return
    let viewer: ReturnType<typeof buildScene>
    try {
      viewer = buildScene(containerRef.current, model)
    } catch {
      // WebGL bisa tidak tersedia di perangkat lama atau saat dimatikan.
      queueMicrotask(() =>
        setState({
          id: modelId,
          error: "Browser ini tidak bisa menampilkan 3D (WebGL tidak aktif).",
        })
      )
      return
    }
    handleRef.current = viewer
    return () => {
      viewer.dispose()
      handleRef.current = null
    }
  }, [model, modelId])

  if (error) {
    return (
      <ErrorAlert
        title="Model 3D gagal dimuat"
        message={error}
        onRetry={() => setAttempt((value) => value + 1)}
      />
    )
  }

  if (!model) {
    return (
      <Skeleton
        className="h-72 w-full rounded-xl sm:h-96"
        aria-label="Memuat model 3D"
      />
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        className="h-72 w-full overflow-hidden rounded-xl border sm:h-96"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="touch"
          onClick={() => handleRef.current?.setView("perspektif")}
        >
          <Box data-icon="inline-start" />
          Perspektif
        </Button>
        <Button
          variant="outline"
          size="touch"
          onClick={() => handleRef.current?.setView("atas")}
        >
          <Square data-icon="inline-start" />
          Tampak Atas
        </Button>
        <Button
          variant="outline"
          size="touch"
          aria-pressed={showOther}
          onClick={() => {
            const next = !showOther
            setShowOther(next)
            handleRef.current?.setOtherLines(next)
          }}
        >
          {showOther ? (
            <EyeOff data-icon="inline-start" />
          ) : (
            <Eye data-icon="inline-start" />
          )}
          {showOther ? "Sembunyikan Garis Lain" : "Tampilkan Garis Lain"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Seret untuk memutar, scroll atau cubit untuk zoom. Dinding diangkat
        seragam {WALL_HEIGHT} m dengan tebal {WALL_THICKNESS * 100} cm, bukan
        ukuran asli. Garis abu di lantai adalah layer yang bukan dinding.
      </p>
    </div>
  )
}

export default DenahViewer
