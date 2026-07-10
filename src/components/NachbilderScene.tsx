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
    hasImage: boolean;
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

function selectStageFragments(fragments: MemoryFragment[], max: number) {
  const byStageSeed = (a: MemoryFragment, b: MemoryFragment) => hash(`stage-${a.id}`) - hash(`stage-${b.id}`);
  const pictured = fragments.filter((fragment) => fragment.imageUrl || fragment.avatarUrl).sort(byStageSeed);
  const textOnly = fragments.filter((fragment) => !fragment.imageUrl && !fragment.avatarUrl).sort(byStageSeed);
  const textBudget = pictured.length > 0 ? Math.min(4, Math.max(2, Math.floor(max * 0.22))) : max;
  const chosen = [
    ...pictured.slice(0, Math.max(0, max - textBudget)),
    ...textOnly.slice(0, textBudget),
  ];
  if (chosen.length < max) {
    const chosenIds = new Set(chosen.map((fragment) => fragment.id));
    const remaining = [...pictured, ...textOnly].filter((fragment) => !chosenIds.has(fragment.id));
    chosen.push(...remaining.slice(0, max - chosen.length));
  }
  return chosen.sort(byStageSeed);
}

function fallbackTexture(fragment: MemoryFragment, index: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 420;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const color = fragment.accentColor || "#9b8fc1";
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(8,11,19,0.58)";
  context.fillRect(10, 10, 300, 400);
  context.globalAlpha = 0.44;
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.strokeRect(11, 11, 298, 398);
  context.globalAlpha = 0.08;
  for (let i = 0; i < 54; i++) {
    const seed = hash(`${fragment.id}-${i}`);
    context.fillStyle = "#ffffff";
    context.fillRect(18 + (seed % 284), 18 + ((seed >>> 8) % 384), 1, 1);
  }
  context.globalAlpha = 1;
  context.fillStyle = "rgba(239,237,228,0.38)";
  context.font = "700 17px system-ui, sans-serif";
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillText(String(index + 1).padStart(2, "0"), 30, 46);
  context.fillStyle = "rgba(239,237,228,0.9)";
  context.font = "500 31px Georgia, serif";
  const shortName = fragment.name.length > 18 ? `${fragment.name.slice(0, 17)}…` : fragment.name;
  context.fillText(shortName, 30, 330);
  context.fillStyle = "rgba(239,237,228,0.46)";
  context.font = "700 13px system-ui, sans-serif";
  context.fillText(fragment.role.toUpperCase(), 30, 365);
  context.globalAlpha = 0.5;
  context.fillStyle = color;
  context.fillRect(30, 386, 54, 2);

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

  const visible = fragments;
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

    if (!reducedMotion && pointerId === null) rotation += 0.00018;
    const centerX = width * 0.5;
    const centerY = height * 0.49;
    const spreadX = Math.min(width * 0.39, 500) * zoom;
    const spreadY = Math.min(height * 0.3, 250) * zoom;
    const layout = visible.map((fragment, index) => {
      const seed = hash(fragment.id);
      const angle = index * GOLDEN_ANGLE + rotation;
      const depth = (Math.sin(angle) + 1) * 0.5;
      const ring = 0.78 + ((seed >>> 5) % 21) / 100;
      const x = centerX + Math.cos(angle) * spreadX * ring;
      const breathing = reducedMotion ? 0 : Math.sin(seconds * 0.42 + seed * 0.001) * 5;
      const y = centerY + Math.sin(angle) * spreadY * ring + breathing;
      const scale = 0.72 + depth * 0.24;
      return { fragment, seed, angle, depth, x, y, scale };
    }).sort((a, b) => a.depth - b.depth);

    context.lineWidth = 0.7;
    context.strokeStyle = "rgba(206,214,226,0.07)";
    context.beginPath();
    for (let index = 0; index < layout.length - 2; index += 2) {
      context.moveTo(layout[index].x, layout[index].y);
      context.lineTo(layout[index + 2].x, layout[index + 2].y);
    }
    context.stroke();

    hitAreas = [];
    for (const item of layout) {
      const selected = activeRef.current === item.fragment.id;
      const source = item.fragment.imageUrl || item.fragment.avatarUrl;
      const cardWidth = (source ? (width < 700 ? 62 : 88) : (width < 700 ? 38 : 48)) * item.scale * (selected ? 1.1 : 1);
      const cardHeight = cardWidth * (source ? 1.28 : 1.72);
      const image = images.get(item.fragment.id);
      context.save();
      context.translate(item.x, item.y);
      context.rotate(((item.seed % 15) - 7) * 0.012 + Math.sin(item.angle) * 0.025);
      context.shadowColor = item.fragment.accentColor;
      context.shadowBlur = selected ? 18 : source ? 6 : 0;
      context.globalAlpha = selected ? 1 : source ? 0.78 + item.depth * 0.14 : 0.42;
      if (image) {
        context.drawImage(image, -cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight);
        context.fillStyle = "rgba(5,7,14,0.18)";
        context.fillRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight);
      } else {
        context.fillStyle = "rgba(9,12,20,0.68)";
        context.fillRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight);
        context.fillStyle = "rgba(245,242,233,0.72)";
        context.font = `${Math.max(8, Math.round(cardWidth * 0.17))}px Georgia, serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(item.fragment.name.split(" ")[0].slice(0, 8), 0, cardHeight * 0.22);
      }
      context.shadowBlur = 0;
      context.strokeStyle = selected ? "rgba(244,241,232,0.82)" : source ? "rgba(222,224,218,0.34)" : "rgba(222,224,218,0.2)";
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
    const maxFragments = mobile ? 11 : 17;
    const visibleFragments = selectStageFragments(fragments, maxFragments);
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
    scene.fog = new THREE.FogExp2(0x050711, 0.048);
    const camera = new THREE.PerspectiveCamera(mobile ? 54 : 45, 1, 0.1, 40);
    camera.position.set(0, 0, mobile ? 9.1 : 8.8);

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
      const theta = index * GOLDEN_ANGLE + (seed % 100) / 190;
      const radius = mobile ? 2.55 + ((seed >>> 4) % 45) / 100 : 3.75 + ((seed >>> 4) % 62) / 100;
      const x = Math.cos(theta) * radius;
      const y = Math.sin(theta) * (mobile ? 2.75 : 3.05) + (((seed >>> 10) % 31) - 15) / 100;
      const z = -0.95 + ((seed >>> 15) % 130) / 100;
      const base = new THREE.Vector3(x, y, z);

      const source = fragment.imageUrl || fragment.avatarUrl;
      const hasImage = !!source;
      const width = hasImage
        ? (mobile ? 0.68 : 0.82 + (seed % 12) / 100)
        : (mobile ? 0.38 : 0.48 + (seed % 8) / 100);
      const height = width * (hasImage ? 1.3 : 1.72);
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

      const fallback = fallbackTexture(fragment, index);
      if (fallback) textures.push(fallback);
      const material = new THREE.MeshBasicMaterial({
        map: fallback,
        color: 0xffffff,
        transparent: true,
        opacity: hasImage ? 0.88 : 0.36,
        side: THREE.FrontSide,
        depthWrite: hasImage,
      });
      materials.push(material);

      const mesh = new THREE.Mesh(geometry, material) as FragmentMesh;
      const restRotation = ((seed % 17) - 8) * 0.011;
      mesh.position.copy(base);
      mesh.lookAt(camera.position);
      mesh.rotateZ(restRotation);
      mesh.userData = {
        id: fragment.id,
        base,
        phase: (seed % 628) / 100,
        restRotation,
        source,
        textureRequested: false,
        hasImage,
      };
      sculpture.add(mesh);
      meshes.push(mesh);

      const edges = new THREE.EdgesGeometry(geometry, 28);
      const edgeMaterial = new THREE.LineBasicMaterial({
        color: new THREE.Color(fragment.accentColor || "#d9d5c8"),
        transparent: true,
        opacity: hasImage ? 0.2 : 0.12,
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
      opacity: 0.055,
      depthWrite: false,
    });
    const connections = new THREE.LineSegments(connectionGeometry, connectionMaterial);
    sculpture.add(connections);
    geometries.push(connectionGeometry);
    materials.push(connectionMaterial);

    const particleCount = mobile ? 140 : 360;
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
      opacity: 0.25,
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
        velocityY = dx * 0.0022;
        velocityX = dy * 0.0014;
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
      cameraTargetZ = THREE.MathUtils.clamp(cameraTargetZ + event.deltaY * 0.003, mobile ? 7.7 : 7.15, mobile ? 10.5 : 10.8);
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
        sculpture.rotation.y += velocityY + (isIdle ? 0.00014 : 0);
      }
      camera.position.z += (cameraTargetZ - camera.position.z) * 0.075;
      sculpture.updateMatrixWorld(true);

      meshes.forEach((mesh) => {
        const selected = mesh.userData.id === active;
        if (selected) requestTexture(mesh);
        const breathing = reducedMotion ? 0 : Math.sin(seconds * 0.42 + mesh.userData.phase) * 0.055;
        mesh.position.x += (mesh.userData.base.x - mesh.position.x) * 0.045;
        mesh.position.y = mesh.userData.base.y + breathing;
        mesh.position.z = mesh.userData.base.z + (selected ? 0.22 : 0) + breathing * 0.45;
        mesh.lookAt(camera.position);
        mesh.rotateZ(mesh.userData.restRotation + (reducedMotion ? 0 : Math.sin(seconds * 0.22 + mesh.userData.phase) * 0.014));
        const scale = selected ? 1.1 : 1;
        mesh.scale.x += (scale - mesh.scale.x) * 0.1;
        mesh.scale.y += (scale - mesh.scale.y) * 0.1;
        const restingOpacity = mesh.userData.hasImage ? 0.86 : 0.3;
        mesh.material.opacity += ((selected ? 1 : restingOpacity) - mesh.material.opacity) * 0.08;
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
