"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export type MemoryFragment = {
  id: string;
  name: string;
  role: string;
  href: string;
  avatarUrl: string | null;
  imageUrl: string | null;
  accentColor: string;
  text: string | null;
  className: string;
  postCount: number;
};

type Props = {
  fragments: MemoryFragment[];
  activeId: string | null;
  reducedMotion: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onReady: () => void;
};

type FragmentMesh = THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> & {
  userData: {
    id: string;
    base: THREE.Vector3;
    phase: number;
    restRotation: number;
    source: string | null;
    textureRequested: boolean;
  };
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function hash(value: string) {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) {
    result ^= value.charCodeAt(i);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function fallbackTexture(fragment: MemoryFragment) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 320;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const color = fragment.accentColor || "#9b8fc1";
  const gradient = context.createLinearGradient(0, 0, 256, 320);
  gradient.addColorStop(0, "#101522");
  gradient.addColorStop(0.55, color);
  gradient.addColorStop(1, "#080a11");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 320);

  context.globalAlpha = 0.13;
  for (let i = 0; i < 90; i++) {
    const seed = hash(`${fragment.id}-${i}`);
    context.fillStyle = i % 2 ? "#ffffff" : "#06070c";
    context.fillRect(seed % 256, (seed >>> 8) % 320, 1 + (seed % 3), 1);
  }
  context.globalAlpha = 1;
  context.fillStyle = "rgba(246,242,231,0.92)";
  context.font = "600 66px Georgia, serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(initials(fragment.name), 128, 155);
  context.fillStyle = "rgba(246,242,231,0.68)";
  context.font = "600 14px system-ui, sans-serif";
  context.fillText(fragment.role.toUpperCase(), 128, 270);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function supportsUsableWebGL() {
  try {
    const probe = document.createElement("canvas");
    const context = probe.getContext("webgl2") || probe.getContext("webgl");
    if (!context) return false;
    const precision = context.getShaderPrecisionFormat(context.VERTEX_SHADER, context.HIGH_FLOAT);
    return !!precision && precision.precision > 0;
  } catch {
    return false;
  }
}

function startLiteScene(
  canvas: HTMLCanvasElement,
  fragments: MemoryFragment[],
  reducedMotion: boolean,
  activeRef: React.MutableRefObject<string | null>,
  onHoverRef: React.MutableRefObject<(id: string | null) => void>,
  onSelectRef: React.MutableRefObject<(id: string) => void>,
  onReadyRef: React.MutableRefObject<() => void>,
) {
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    onReadyRef.current();
    return () => {};
  }

  const visible = fragments.slice(0, window.matchMedia("(max-width: 720px)").matches ? 18 : 34);
  const dpr = Math.min(window.devicePixelRatio || 1, 1.35);
  const images = new Map<string, HTMLImageElement>();
  let width = 1;
  let height = 1;
  let rotation = 0;
  let zoom = 1;
  let pointerId: number | null = null;
  let pointerX = 0;
  let pointerY = 0;
  let dragDistance = 0;
  let hovered: string | null = null;
  let raf = 0;
  let lastFrame = 0;
  let ready = false;
  let hitAreas: Array<{ id: string; x: number; y: number; width: number; height: number }> = [];

  const imageBudget = window.matchMedia("(max-width: 720px)").matches ? 8 : 14;
  for (const fragment of visible.slice(0, imageBudget)) {
    const source = fragment.imageUrl || fragment.avatarUrl;
    if (!source) continue;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.src = source;
    image.onload = () => images.set(fragment.id, image);
  }

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  const draw = (time: number) => {
    raf = requestAnimationFrame(draw);
    if (time - lastFrame < 1000 / 30) return;
    lastFrame = time;
    const seconds = time * 0.001;
    const background = context.createRadialGradient(width * 0.5, height * 0.47, 0, width * 0.5, height * 0.47, Math.max(width, height) * 0.68);
    background.addColorStop(0, "#111827");
    background.addColorStop(0.48, "#090d18");
    background.addColorStop(1, "#050711");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    if (!reducedMotion && pointerId === null) rotation += 0.00034;
    const centerX = width * 0.5;
    const centerY = height * 0.49;
    const spreadX = Math.min(width * 0.37, 470) * zoom;
    const spreadY = Math.min(height * 0.35, 300) * zoom;
    const layout = visible.map((fragment, index) => {
      const seed = hash(fragment.id);
      const angle = index * GOLDEN_ANGLE + rotation;
      const depth = (Math.sin(angle) + 1) * 0.5;
      const ring = 0.56 + ((seed >>> 5) % 42) / 100;
      const x = centerX + Math.cos(angle) * spreadX * ring;
      const normalized = visible.length === 1 ? 0 : index / (visible.length - 1) - 0.5;
      const breathing = reducedMotion ? 0 : Math.sin(seconds * 0.42 + seed * 0.001) * 5;
      const y = centerY + normalized * spreadY * 1.62 + Math.sin(angle * 1.7) * 34 + breathing;
      const scale = 0.68 + depth * 0.43;
      return { fragment, seed, angle, depth, x, y, scale };
    }).sort((a, b) => a.depth - b.depth);

    context.lineWidth = 0.7;
    context.strokeStyle = "rgba(206,214,226,0.12)";
    context.beginPath();
    for (let index = 0; index < layout.length - 2; index += 2) {
      context.moveTo(layout[index].x, layout[index].y);
      context.lineTo(layout[index + 2].x, layout[index + 2].y);
    }
    context.stroke();

    hitAreas = [];
    for (const item of layout) {
      const selected = activeRef.current === item.fragment.id;
      const cardWidth = (width < 700 ? 74 : 102) * item.scale * (selected ? 1.12 : 1);
      const cardHeight = cardWidth * 1.28;
      const image = images.get(item.fragment.id);
      context.save();
      context.translate(item.x, item.y);
      context.rotate(((item.seed % 15) - 7) * 0.012 + Math.sin(item.angle) * 0.025);
      context.shadowColor = item.fragment.accentColor;
      context.shadowBlur = selected ? 24 : 9;
      context.globalAlpha = selected ? 1 : 0.74 + item.depth * 0.18;
      if (image) {
        context.drawImage(image, -cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight);
        context.fillStyle = "rgba(5,7,14,0.18)";
        context.fillRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight);
      } else {
        const fill = context.createLinearGradient(0, -cardHeight / 2, 0, cardHeight / 2);
        fill.addColorStop(0, "#151b29");
        fill.addColorStop(0.56, item.fragment.accentColor);
        fill.addColorStop(1, "#090b13");
        context.fillStyle = fill;
        context.fillRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight);
        context.fillStyle = "rgba(245,242,233,0.92)";
        context.font = `${Math.round(cardWidth * 0.31)}px Georgia, serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(initials(item.fragment.name), 0, -2);
      }
      context.shadowBlur = 0;
      context.strokeStyle = selected ? "rgba(244,241,232,0.82)" : "rgba(222,224,218,0.42)";
      context.strokeRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight);
      context.restore();
      hitAreas.push({ id: item.fragment.id, x: item.x - cardWidth / 2, y: item.y - cardHeight / 2, width: cardWidth, height: cardHeight });
    }
    context.globalAlpha = 1;
    if (!ready) {
      ready = true;
      onReadyRef.current();
    }
  };

  const hitTest = (x: number, y: number) => {
    for (let index = hitAreas.length - 1; index >= 0; index--) {
      const area = hitAreas[index];
      if (x >= area.x && x <= area.x + area.width && y >= area.y && y <= area.y + area.height) return area.id;
    }
    return null;
  };
  const down = (event: PointerEvent) => {
    if (pointerId !== null) return;
    pointerId = event.pointerId;
    pointerX = event.clientX;
    pointerY = event.clientY;
    dragDistance = 0;
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = "grabbing";
  };
  const move = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    if (pointerId === event.pointerId) {
      const delta = event.clientX - pointerX;
      dragDistance += Math.abs(delta) + Math.abs(event.clientY - pointerY);
      rotation += delta * 0.004;
      pointerX = event.clientX;
      pointerY = event.clientY;
      return;
    }
    const next = hitTest(event.clientX - rect.left, event.clientY - rect.top);
    if (next !== hovered) {
      hovered = next;
      onHoverRef.current(next);
      canvas.style.cursor = next ? "pointer" : "grab";
    }
  };
  const up = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) return;
    const rect = canvas.getBoundingClientRect();
    const hit = hitTest(event.clientX - rect.left, event.clientY - rect.top);
    if (dragDistance < 8 && hit) onSelectRef.current(hit);
    canvas.releasePointerCapture(event.pointerId);
    pointerId = null;
    canvas.style.cursor = hit ? "pointer" : "grab";
  };
  const wheel = (event: WheelEvent) => {
    event.preventDefault();
    zoom = THREE.MathUtils.clamp(zoom - event.deltaY * 0.0007, 0.75, 1.32);
  };

  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", wheel, { passive: false });
  raf = requestAnimationFrame(draw);

  return () => {
    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    canvas.removeEventListener("pointerdown", down);
    canvas.removeEventListener("pointermove", move);
    canvas.removeEventListener("pointerup", up);
    canvas.removeEventListener("pointercancel", up);
    canvas.removeEventListener("wheel", wheel);
    onHoverRef.current(null);
  };
}

export function NachbilderScene({ fragments, activeId, reducedMotion, onHover, onSelect, onReady }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(activeId);
  const onHoverRef = useRef(onHover);
  const onSelectRef = useRef(onSelect);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    activeRef.current = activeId;
  }, [activeId]);
  useEffect(() => {
    onHoverRef.current = onHover;
    onSelectRef.current = onSelect;
    onReadyRef.current = onReady;
  }, [onHover, onReady, onSelect]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || fragments.length === 0) return;
    const canvas = document.createElement("canvas");
    canvas.className = "nb-canvas";
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);

    const mobile = window.matchMedia("(max-width: 720px)").matches;
    const maxFragments = mobile ? 24 : 46;
    const visibleFragments = fragments.slice(0, maxFragments);
    if (!supportsUsableWebGL()) {
      const stopLite = startLiteScene(canvas, visibleFragments, reducedMotion, activeRef, onHoverRef, onSelectRef, onReadyRef);
      return () => {
        stopLite();
        canvas.remove();
      };
    }
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: !mobile,
        powerPreference: "high-performance",
      });
    } catch {
      canvas.remove();
      const liteCanvas = document.createElement("canvas");
      liteCanvas.className = "nb-canvas";
      liteCanvas.setAttribute("aria-hidden", "true");
      host.appendChild(liteCanvas);
      const stopLite = startLiteScene(liteCanvas, visibleFragments, reducedMotion, activeRef, onHoverRef, onSelectRef, onReadyRef);
      return () => {
        stopLite();
        liteCanvas.remove();
      };
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.2 : 1.55));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x050711, 1);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050711, 0.055);
    const camera = new THREE.PerspectiveCamera(mobile ? 54 : 45, 1, 0.1, 40);
    camera.position.set(0, 0, mobile ? 8.6 : 7.4);

    const sculpture = new THREE.Group();
    sculpture.rotation.set(-0.08, -0.18, 0.02);
    scene.add(sculpture);

    const meshes: FragmentMesh[] = [];
    const textures: THREE.Texture[] = [];
    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    let destroyed = false;

    const requestTexture = (mesh: FragmentMesh) => {
      if (!mesh.userData.source || mesh.userData.textureRequested) return;
      mesh.userData.textureRequested = true;
      loader.load(
        mesh.userData.source,
        (texture) => {
          if (destroyed) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          mesh.material.map = texture;
          mesh.material.needsUpdate = true;
          textures.push(texture);
        },
        undefined,
        () => {},
      );
    };

    visibleFragments.forEach((fragment, index) => {
      const seed = hash(fragment.id);
      const count = Math.max(visibleFragments.length, 1);
      const normalized = count === 1 ? 0.5 : index / (count - 1);
      const y = (0.5 - normalized) * (mobile ? 5.2 : 5.8);
      const radius = mobile ? 2.2 + ((seed >>> 4) % 80) / 100 : 3.05 + ((seed >>> 4) % 105) / 100;
      const theta = index * GOLDEN_ANGLE + (seed % 100) / 190;
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * 1.65 - ((seed >>> 12) % 50) / 100;
      const base = new THREE.Vector3(x, y, z);

      const width = mobile ? 1.05 : 1.2 + (seed % 22) / 100;
      const height = width * (1.18 + ((seed >>> 5) % 30) / 100);
      const geometry = new THREE.PlaneGeometry(width, height, 6, 8);
      const positions = geometry.attributes.position as THREE.BufferAttribute;
      for (let vertex = 0; vertex < positions.count; vertex++) {
        const px = positions.getX(vertex);
        const py = positions.getY(vertex);
        const wave = Math.sin(px * 3.1 + seed * 0.001) * 0.045 + Math.cos(py * 2.7 + seed * 0.002) * 0.028;
        positions.setZ(vertex, wave);
      }
      positions.needsUpdate = true;
      geometry.computeVertexNormals();
      geometries.push(geometry);

      const fallback = fallbackTexture(fragment);
      if (fallback) textures.push(fallback);
      const material = new THREE.MeshBasicMaterial({
        map: fallback,
        color: 0xffffff,
        transparent: true,
        opacity: 0.82,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      materials.push(material);

      const mesh = new THREE.Mesh(geometry, material) as FragmentMesh;
      const restRotation = ((seed % 17) - 8) * 0.011;
      const source = fragment.imageUrl || fragment.avatarUrl;
      mesh.position.copy(base);
      mesh.rotation.set((seed % 9) * 0.006, -theta * 0.05, restRotation);
      mesh.userData = {
        id: fragment.id,
        base,
        phase: (seed % 628) / 100,
        restRotation,
        source,
        textureRequested: false,
      };
      sculpture.add(mesh);
      meshes.push(mesh);

      const edges = new THREE.EdgesGeometry(geometry, 28);
      const edgeMaterial = new THREE.LineBasicMaterial({
        color: new THREE.Color(fragment.accentColor || "#d9d5c8"),
        transparent: true,
        opacity: 0.32,
      });
      const frame = new THREE.LineSegments(edges, edgeMaterial);
      frame.position.z = 0.012;
      mesh.add(frame);
      geometries.push(edges);
      materials.push(edgeMaterial);

      if (index < (mobile ? 8 : 16)) requestTexture(mesh);
    });

    const connectionPositions: number[] = [];
    for (let i = 0; i < meshes.length; i++) {
      const next = meshes[(i + 3) % meshes.length];
      if (!next || i % 2 !== 0) continue;
      const from = meshes[i].userData.base;
      const to = next.userData.base;
      connectionPositions.push(from.x, from.y, from.z, to.x, to.y, to.z);
    }
    const connectionGeometry = new THREE.BufferGeometry();
    connectionGeometry.setAttribute("position", new THREE.Float32BufferAttribute(connectionPositions, 3));
    const connectionMaterial = new THREE.LineBasicMaterial({
      color: 0xb8c7dc,
      transparent: true,
      opacity: 0.105,
      depthWrite: false,
    });
    const connections = new THREE.LineSegments(connectionGeometry, connectionMaterial);
    sculpture.add(connections);
    geometries.push(connectionGeometry);
    materials.push(connectionMaterial);

    const particleCount = mobile ? 260 : 720;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const seed = hash(`particle-${i}`);
      particlePositions[i * 3] = ((seed % 1000) / 1000 - 0.5) * 17;
      particlePositions[i * 3 + 1] = (((seed >>> 10) % 1000) / 1000 - 0.5) * 11;
      particlePositions[i * 3 + 2] = (((seed >>> 20) % 1000) / 1000 - 0.5) * 12;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xd7d5c9,
      size: mobile ? 0.018 : 0.022,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);
    geometries.push(particleGeometry);
    materials.push(particleMaterial);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(4, 4);
    let hoveredId: string | null = null;
    let dragPointer: number | null = null;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragX = 0;
    let dragY = 0;
    let moved = false;
    let velocityX = 0;
    let velocityY = 0;
    let cameraTargetZ = camera.position.z;
    let idleSince = performance.now();
    let raf = 0;
    let lastFrame = 0;
    let readySent = false;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    const updateRaycast = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(meshes, false)[0];
      const nextId = hit ? (hit.object.userData.id as string) : null;
      if (hoveredId !== nextId) {
        hoveredId = nextId;
        canvas.style.cursor = nextId ? "pointer" : dragPointer === null ? "grab" : "grabbing";
        onHoverRef.current(nextId);
      }
    };

    const pointerDown = (event: PointerEvent) => {
      if (dragPointer !== null) return;
      dragPointer = event.pointerId;
      dragStartX = dragX = event.clientX;
      dragStartY = dragY = event.clientY;
      moved = false;
      idleSince = performance.now();
      canvas.style.cursor = "grabbing";
      canvas.setPointerCapture(event.pointerId);
    };
    const pointerMove = (event: PointerEvent) => {
      if (dragPointer === event.pointerId) {
        const dx = event.clientX - dragX;
        const dy = event.clientY - dragY;
        dragX = event.clientX;
        dragY = event.clientY;
        if (Math.abs(event.clientX - dragStartX) + Math.abs(event.clientY - dragStartY) > 7) moved = true;
        velocityY = dx * 0.0028;
        velocityX = dy * 0.0021;
        sculpture.rotation.y += velocityY;
        sculpture.rotation.x += velocityX;
        return;
      }
      updateRaycast(event);
    };
    const pointerUp = (event: PointerEvent) => {
      if (dragPointer !== event.pointerId) return;
      if (!moved) {
        updateRaycast(event);
        if (hoveredId) onSelectRef.current(hoveredId);
      }
      canvas.releasePointerCapture(event.pointerId);
      dragPointer = null;
      canvas.style.cursor = hoveredId ? "pointer" : "grab";
    };
    const pointerLeave = () => {
      if (dragPointer === null && hoveredId) {
        hoveredId = null;
        onHoverRef.current(null);
      }
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      cameraTargetZ = THREE.MathUtils.clamp(cameraTargetZ + event.deltaY * 0.004, mobile ? 6.6 : 4.7, mobile ? 10.2 : 9.5);
      idleSince = performance.now();
    };

    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);
    canvas.addEventListener("pointerleave", pointerLeave);
    canvas.addEventListener("wheel", wheel, { passive: false });

    const render = (time: number) => {
      raf = requestAnimationFrame(render);
      const minFrameTime = mobile ? 1000 / 32 : 1000 / 60;
      if (time - lastFrame < minFrameTime) return;
      lastFrame = time;
      const seconds = time * 0.001;
      const active = activeRef.current;
      const isIdle = time - idleSince > 2200;

      velocityX *= 0.92;
      velocityY *= 0.92;
      if (!reducedMotion && dragPointer === null) {
        sculpture.rotation.x += velocityX;
        sculpture.rotation.y += velocityY + (isIdle ? 0.00032 : 0);
      }
      camera.position.z += (cameraTargetZ - camera.position.z) * 0.075;

      meshes.forEach((mesh) => {
        const selected = mesh.userData.id === active;
        if (selected) requestTexture(mesh);
        const breathing = reducedMotion ? 0 : Math.sin(seconds * 0.42 + mesh.userData.phase) * 0.055;
        mesh.position.x += (mesh.userData.base.x - mesh.position.x) * 0.045;
        mesh.position.y = mesh.userData.base.y + breathing;
        mesh.position.z = mesh.userData.base.z + (selected ? 0.34 : 0) + breathing * 0.7;
        mesh.rotation.z = mesh.userData.restRotation + (reducedMotion ? 0 : Math.sin(seconds * 0.25 + mesh.userData.phase) * 0.025);
        const scale = selected ? 1.16 : 1;
        mesh.scale.x += (scale - mesh.scale.x) * 0.1;
        mesh.scale.y += (scale - mesh.scale.y) * 0.1;
        mesh.material.opacity += ((selected ? 1 : 0.78) - mesh.material.opacity) * 0.08;
      });
      if (!reducedMotion) particles.rotation.y = seconds * 0.004;

      renderer.render(scene, camera);
      if (!readySent) {
        readySent = true;
        onReadyRef.current();
      }
    };

    const visibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else {
        lastFrame = performance.now();
        raf = requestAnimationFrame(render);
      }
    };
    document.addEventListener("visibilitychange", visibility);
    raf = requestAnimationFrame(render);

    return () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", visibility);
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      canvas.removeEventListener("pointerleave", pointerLeave);
      canvas.removeEventListener("wheel", wheel);
      onHoverRef.current(null);
      textures.forEach((texture) => texture.dispose());
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    };
  }, [fragments, reducedMotion]);

  return <div ref={hostRef} className="nb-canvas-host" aria-hidden="true" />;
}
