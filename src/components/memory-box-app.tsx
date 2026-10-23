"use client";

import { ArrowLeft, ArrowRight, ArrowUpRight, Check, CheckCheck, ChevronDown, CircleHelp, Copy, Flag, GitBranch, Hand, Image as ImageIcon, Leaf, Link2, List, MapPin, Maximize2, MessageCircle, Minimize2, Paintbrush, Pencil, Plus, Search, Send, Shuffle, Sparkles, StickyNote, Trash2, Undo2, UserRound, UsersRound, WifiOff, X } from "./pixel-icons";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { AnswerResponse, Memory, MemoryType, NewMemory, Pixel, SceneId, SearchResponse, SessionIdentity } from "@/lib/types";
import { PAPER_COLORS, SCENES, SHAPES, memorySize, sceneById, sceneForPoint, shapePixels, suggestedSpot, type ShapeId } from "@/lib/scenes";
import { api, uploadImage } from "@/lib/client/api";
import { getBrowserSupabase } from "@/lib/client/supabase";
import { useWorld } from "@/lib/client/use-world";
import { usePresence } from "@/lib/client/use-presence";
import { usePaintTurn } from "@/lib/client/use-paint-turn";
import type { PaintTurnTiming } from "@/lib/client/paint-turn";
import { areaAtPoint, chooseWorldStory, newPlaceGround, worldAreas, type WorldArea } from "@/lib/client/world-atlas";
import { WorldMap } from "./world-map";
import { AreaMark } from "./world-geography";
import { LIVING_LANDMARKS } from "@/lib/living-landmarks";
import { WATERLOO_LANDMARKS } from "@/lib/waterloo-landmarks";
import { campusArrival } from "@/lib/client/campus-arrival";
import { answerSourcesChanged, citedSourceCount, projectSearch } from "@/lib/client/source-state";
import { mergePaintCells, screenToWorld, zoomCameraAt } from "@/lib/client/canvas-geometry";
import { clampMemoryPoint, GRID_SIZE } from "@/lib/world-bounds";
import { MemoryComposer, newDraft, type MemoryDraft } from "./memory-composer";
import { MemoryResult } from "./memory-card";
import { CanvasDock } from "./canvas-dock";
import { BoxMark } from "./box-mark";
import { PixelToolIcon } from "./pixel-tool-icon";
import { ToolButton, ToolHints } from "./tool-button";
import { WorldCanvas, type CameraCommand, type CameraView, type PendingPlacement } from "./world-canvas";
import { parseSharedPlace, sharedPlaceFromCamera, sharedPlaceForOriginal, type SharedPlace } from "@/lib/client/shared-place";
import { SharePlacePanel } from "./share-place-panel";
import { PaintKit } from "./paint-kit";
import { StoryPeek } from "./story-peek";
import { BuildWorkbench } from "./build-workbench";
import { openBuildInvitations } from "@/lib/client/build-invitations";
import { originalLabel } from "@/lib/client/memory-presentation";
import { neighborhoodCamera } from "@/lib/client/story-neighborhood";
import { memoryContributionMark, paintContributionMark, type ContributionMark } from "@/lib/client/contribution-feedback";

type Panel = "scene" | "paint" | "compose" | "inspect" | "search" | "activity" | "browse" | "profile" | "report" | "together" | "build" | "people" | "share" | "world" | null;
type Pending = { kind: "paint"; x: number; y: number; shape: ShapeId; color: string; opId: string } | { kind: "memory"; x: number; y: number; sceneId: SceneId };
type SavedPaint = {operationId:string;buildId:string|null};
const PANEL_TITLES: Record<Exclude<Panel, null>, string> = { scene: "Patch", paint: "Paint", compose: "Add to the canvas", inspect: "Original", search: "Find a memory", activity: "Activity", browse: "Browse", profile: "Your profile", report: "Report a contribution", together: "Build together", build: "Build here", people: "Who’s here", share: "Meet here", world:"World map" };
const relativeDate = (date: string) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(date));
function revealMobilePanel() {
  // The reader is now a bottom sheet over the world. Keep the shared place in view.
}

export function MemoryBoxApp() {
  const { world, identity, setIdentity, connection, error: worldError, refresh, retry } = useWorld();
  const presence = usePresence(identity, connection);
  const [activeScene, setActiveScene] = useState<SceneId>("mixtape");
  const [panel, setPanel] = useState<Panel>(null), [selectedId, setSelectedId] = useState<string | null>(null);
  const [landmarkIndex, setLandmarkIndex] = useState(0);
  const [joinedBuildId,setJoinedBuildId] = useState<string|null>(null);
  const [buildCollapsed,setBuildCollapsed]=useState(false);
  const visited = useRef<string[]>([]);
  const [draft, setDraft] = useState<MemoryDraft | null>(null), [pending, setPending] = useState<Pending | null>(null);
  const [shape, setShape] = useState<ShapeId>("goose"), [paintColor, setPaintColor] = useState("#F3617C");
  const [paintMode, setPaintMode] = useState<"draw" | "shape">("draw"), [brushPixels, setBrushPixels] = useState<Pixel[]>([]);
  const [busy, setBusy] = useState(""), [formError, setFormError] = useState(""), [announcement, setAnnouncement] = useState("");
  const [query, setQuery] = useState(""), [searchMode, setSearchMode] = useState<"find" | "ask">("find"), [scope, setScope] = useState<"all" | "scene">("all");
  const [searchData, setSearchData] = useState<SearchResponse | AnswerResponse | null>(null), [searchBusy, setSearchBusy] = useState(false), [searchError, setSearchError] = useState("");
  const [answerInvalid, setAnswerInvalid] = useState(false), [backToSearch, setBackToSearch] = useState(false);
  const [lastPaint, setLastPaint] = useState<SavedPaint | null>(null), [justPublished, setJustPublished] = useState<string | null>(null);
  const [contribution, setContribution] = useState<ContributionMark | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false), [profileName, setProfileName] = useState("");
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [showAllSources, setShowAllSources] = useState(false);
  const [backToDraft, setBackToDraft] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null), [reportReason, setReportReason] = useState("");
  const [command, setCommand] = useState<CameraCommand>({ key: 0, type: "fit" });
  const [sharePlace, setSharePlace] = useState<SharedPlace | null>(null);
  const [incomingPlace, setIncomingPlace] = useState<SharedPlace | null>(null);
  const [arrival, setArrival] = useState<SharedPlace | null>(null);
  const [mapCamera,setMapCamera]=useState<CameraView|null>(null);
  const mapCameraTick=useRef(0),currentAreaId=useRef<string|null>(null);
  const {seconds:paintWait,known:paintTurnKnown,accept:acceptPaintTurn,rejected:handlePaintRejection}=usePaintTurn(identity?.id,connection==="live",panel==="paint"||pending?.kind==="paint");
  const panelHeading = useRef<HTMLHeadingElement>(null), searchInput = useRef<HTMLTextAreaElement>(null), searchSequence = useRef(0);
  const previewInvoker = useRef<HTMLElement | null>(null);
  const invitationElement = useRef<HTMLButtonElement>(null), livePainter = useRef(presence.peers.find(peer=>peer.tool==="paint"));
  livePainter.current=presence.peers.find(peer=>peer.tool==="paint");
  const keepInputFocus = useRef(false);
  const cameraView = useRef<CameraView | null>(null), searchCamera = useRef<CameraView | null>(null), brushOperation = useRef<string | null>(null);
  const searchOrigin = useRef<{ id: string; scroll: number; pageScroll: number; citation: boolean } | null>(null), panelContent = useRef<HTMLDivElement>(null), panelScroller = useRef<HTMLElement>(null), draftScene = useRef<SceneId>("mixtape");
  const searchDataRef = useRef(searchData), connectionRef = useRef(connection);
  searchDataRef.current = searchData; connectionRef.current = connection;
  const panelRef = useRef(panel); panelRef.current = panel;

  useEffect(() => {
    if (!contribution) return;
    const timeout = window.setTimeout(() => setContribution(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [contribution]);

  useEffect(() => {
    const readLink = () => {
      const place = parseSharedPlace(window.location.hash);
      setArrival(null);
      setIncomingPlace(place);
      if (place && (panelRef.current === "compose" || panelRef.current === "paint")) setAnnouncement("A shared spot is ready. Finish your preview or close your tool to open it. Your draft stays here.");
      if (!place && /(?:^#|&)at=/.test(window.location.hash)) setAnnouncement("That spot link isn’t valid. You can still explore the canvas.");
    };
    readLink();
    window.addEventListener("hashchange", readLink);
    return () => window.removeEventListener("hashchange", readLink);
  }, []);

  useEffect(() => {
    if (!world || !incomingPlace || busy || pending || panel === "compose" || panel === "paint" || brushPixels.length) return;
    const original = world.memories.find(memory => memory.id === incomingPlace.memoryId);
    setIncomingPlace(null); setArrival(original ? null : incomingPlace); setSelectedId(original?.id ?? null);
    setBackToSearch(false); setBackToDraft(false); setPanelExpanded(false); setDeleteConfirm(false); setFormError("");
    setActiveScene(original?.sceneId ?? sceneForPoint(incomingPlace.x, incomingPlace.y));
    if (original) {
      setPanel("inspect");
      setCommand(old => ({ key: old.key + 1, type: "focus", points: [{ ...original, ...memorySize(original) }] }));
    } else {
      setPanel(null);
      setCommand(old => ({ key: old.key + 1, type: "place", place: incomingPlace }));
    }
    setAnnouncement(original ? "Opened the shared original." : incomingPlace.memoryId ? "That original is no longer available. You’re at its shared spot." : "You’re at the shared spot. Choose a tool to join in.");
  }, [world, incomingPlace, busy, pending, panel, brushPixels.length]);

  const selected = world?.memories.find((memory) => memory.id === selectedId);
  const parent = world?.memories.find((memory) => memory.id === draft?.inspiredBy);
  const joinedBuild = world?.memories.find(memory=>memory.id===joinedBuildId);
  const lastPaintSource=lastPaint?.buildId&&world?.memories.some(memory=>memory.id===lastPaint.buildId)?lastPaint.buildId:undefined;
  const invitations = useMemo(()=>openBuildInvitations(world?.memories??[]),[world]);
  const areas=useMemo(()=>worldAreas(world?.memories??[],world?.pixels??[]),[world?.memories,world?.pixels]);
  const areasRef=useRef(areas);areasRef.current=areas;
  const active = sceneById(activeScene);
  const campusAvailable=!!world&&!!campusArrival(world.memories);
  const landmarks=campusAvailable?[...WATERLOO_LANDMARKS,...LIVING_LANDMARKS]:LIVING_LANDMARKS;
  const landmark = landmarks[landmarkIndex % landmarks.length];
  const invitationLandmark=useRef(landmark);invitationLandmark.current=landmark;
  const compactBuild=panel==="build"&&buildCollapsed&&!!selected?.isBuildInvitation;
  const panelTitle = compactBuild&&selected?originalLabel(selected):panel === "search" ? searchMode === "ask" ? "Ask the box" : "Find a memory" : panel === "compose" && draft?.editId ? "Edit your memory" : panel === "compose" && draft?.isBuildInvitation ? "Start a build" : panel === "compose" && draft?.inspiredBy ? "Build on a memory" : panel ? PANEL_TITLES[panel] : "";
  const canWrite = !!identity && connection === "live";
  const isAnswer = (data: SearchResponse | AnswerResponse | null): data is AnswerResponse => !!data && "status" in data;
  const currentSearchData = useMemo(() => searchData && world ? projectSearch(searchData, world.memories) : null, [searchData, world]);
  const effectiveAnswerInvalid = answerInvalid || !!(searchData && "sourceVersions" in searchData && world && answerSourcesChanged(searchData.sourceVersions, world.memories, searchData.results.map(result => result.memory)));
  const foundIds = (panel === "search" || backToSearch) ? currentSearchData?.results.map((result) => result.memory.id) ?? [] : [];

  useEffect(() => { if (!announcement) return; const timer=setTimeout(() => setAnnouncement(""), 6500); return () => clearTimeout(timer); }, [announcement]);

  useEffect(() => { if (keepInputFocus.current) { keepInputFocus.current = false; return; } if (panel) { panelHeading.current?.focus({ preventScroll: true }); revealMobilePanel(); } }, [panel, selectedId]);
  useEffect(() => {
    const url = draft?.previewUrl;
    return () => { if (url?.startsWith("blob:")) URL.revokeObjectURL(url); };
  }, [draft?.previewUrl]);
  useEffect(() => {
    const data = searchDataRef.current;
    if (!world || !data) return;
    if ("sourceVersions" in data && answerSourcesChanged(data.sourceVersions, world.memories, data.results.map(result => result.memory))) {
      setAnswerInvalid(true); setAnnouncement("A memory behind this answer changed. Ask again to read the current originals.");
    }
  }, [world]);

  const cameraTo = useCallback((points: CameraCommand["points"], type: "focus" | "frame" = "focus") => setCommand((old) => ({ key: old.key + 1, type, points })), []);
  const rememberCamera = useCallback((view: CameraView) => {
    cameraView.current = view;
    currentAreaId.current=areaAtPoint(areasRef.current,screenToWorld(view,{x:view.width/2,y:view.height/2}))?.id??null;
    if(panelRef.current==="world"&&performance.now()-mapCameraTick.current>100){mapCameraTick.current=performance.now();setMapCamera(view);}
    const element=invitationElement.current;if(!element)return;
    const place=invitationLandmark.current,painter=livePainter.current;
    const x=(painter?.x??place.x+place.width/2)*view.z+view.x;
    const y=(painter?.y??place.y)*view.z+view.y-65;
    element.hidden=!painter||view.z>.72||x<45||x>view.width-45||y<95||y>view.height-130;
    element.style.left=`${Math.max(125,Math.min(view.width-125,x))}px`;
    element.style.top=`${y}px`;
  }, []);
  useEffect(()=>{if(cameraView.current)rememberCamera(cameraView.current);},[panel,presence.peers,world,rememberCamera]);
  const returnToSearch = () => {
    keepInputFocus.current = true;
    setPanel("search"); setSelectedId(null); setBackToSearch(false);
    if (searchCamera.current) setCommand(old => ({ key: old.key + 1, type: "restore", camera: searchCamera.current! }));
    requestAnimationFrame(() => {
      if (panelScroller.current && searchOrigin.current) panelScroller.current.scrollTop = searchOrigin.current.scroll;
      if (searchOrigin.current) window.scrollTo({ top: searchOrigin.current.pageScroll, behavior: "instant" });
      const button = searchOrigin.current && panelContent.current?.querySelector<HTMLButtonElement>(`${searchOrigin.current.citation ? ".citation" : ".memory-result"}[data-source-id="${searchOrigin.current.id}"]`);
      button?.focus({ preventScroll: true });
      button?.scrollIntoView({ block: "nearest", behavior: "instant" });
    });
  };
  const revealCanvas = () => requestAnimationFrame(() => document.querySelector(".world-board")?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }));
  const showScene = (id: SceneId) => {
    setActiveScene(id); setSelectedId(null); setBackToSearch(false); setPending(null); setPanel("scene"); setFormError("");
    const scene = sceneById(id); cameraTo([{ x: scene.x - 240, y: scene.y - 185, width: 480, height: 370 }], "frame");
  };
  const openMemory = (id: string, fromSearch = false, fromDraft = false) => {
    setArrival(null);
    setAnnouncement("");
    setBackToDraft(fromDraft && !!draft);
    const memory = world?.memories.find((item) => item.id === id);
    if (fromSearch && !backToSearch) { searchCamera.current = cameraView.current ? { ...cameraView.current } : null; searchOrigin.current = { id, scroll: panelScroller.current?.scrollTop ?? 0, pageScroll: window.scrollY, citation: !!document.activeElement?.classList.contains("citation") }; }
    setSelectedId(id); setPanel("inspect"); setPanelExpanded(false); setPending(null); setBackToSearch(fromSearch); setDeleteConfirm(false); setFormError(""); setJustPublished(null);
    if (memory) { setActiveScene(memory.sceneId); cameraTo([{ ...memory, ...memorySize(memory) }]); }
  };
  const focusNeighborhood=(memory:Memory,mode:"peek"|"compose"="peek")=>{
    const view=cameraView.current;if(!view)return;
    const camera=neighborhoodCamera({...memory,...memorySize(memory)},(world?.memories??[]).map(m=>({...m,...memorySize(m)})),view,mode);
    setCommand(old=>({key:old.key+1,type:"restore",camera:{...view,...camera}}));
  };
  const peekMemory=(id:string,navigate=false)=>{
    const memory=world?.memories.find(m=>m.id===id);if(!memory)return;
    if(!document.activeElement?.closest(".story-peek"))previewInvoker.current=document.querySelector<HTMLElement>(navigate?".wander-button":`.memory-card[data-memory-id="${CSS.escape(id)}"]`);
    visited.current=[...visited.current.filter(item=>item!==id).slice(-39),id];
    setArrival(null);setPanel(null);setPending(null);setSelectedId(id);setBackToSearch(false);setBackToDraft(false);setAnnouncement("");setFormError("");
    setActiveScene(memory.sceneId);
    if(navigate)focusNeighborhood(memory);
  };
  const wander = () => {
    const memory = chooseWorldStory(world?.memories ?? [],areas,visited.current,selectedId??currentAreaId.current);
    if (!memory) { setAnnouncement("There is room for the first story. Leave something here."); return; }
    peekMemory(memory.id,true);
  };
  const buildTogether = () => {
    setPending(null); setSelectedId(null); setBackToSearch(false); setBackToDraft(false); setFormError(""); setAnnouncement(""); setPanel("together");
  };
  const followLivePainter = () => {
    const painter = presence.peers.find(peer => peer.tool === "paint");
    if (!painter) { setAnnouncement("That painter moved on. Choose another build or start one here."); return; }
    if (brushPixels.length) { setPanel("paint");setAnnouncement("Add or clear your pixel preview before moving to another build.");return; }
    setJoinedBuildId(null);setSelectedId(null);setPanel("paint");setPaintMode("draw");cameraTo([{x:painter.x-200,y:painter.y-160,width:400,height:320}],"frame");
    setAnnouncement(`You’re at ${painter.name}’s corner. Your preview is shared when you add the pixels.`);
  };
  const joinBuild = (id:string) => {
    if (brushPixels.length && joinedBuildId!==id) { setPanel("paint");setAnnouncement("Add or clear your pixel preview before moving to another build.");return; }
    const memory=world?.memories.find(item=>item.id===id);
    const compact=joinedBuildId===id&&buildCollapsed;
    setBuildCollapsed(compact);
    setJoinedBuildId(id);setSelectedId(id);setPending(null);setPanel("build");setBackToSearch(false);setBackToDraft(false);setFormError("");setAnnouncement("");setArrival(null);
    if(memory){setActiveScene(memory.sceneId);focusNeighborhood(memory,compact?"peek":"compose");}
  };
  const toggleBuildDetails=()=>{
    if(!selected?.isBuildInvitation)return;
    const compact=!buildCollapsed;setBuildCollapsed(compact);focusNeighborhood(selected,compact?"peek":"compose");
  };
  const visitLandmark = (index: number) => {
    setLandmarkIndex(index); const place=landmarks[index];setActiveScene(place.sceneId);setSelectedId(null);setPending(null);setPanel("together");
    cameraTo([{ x:place.x,y:place.y,width:place.width,height:place.height }], "frame");
  };
  const showWholeWorld = () => {
    if(brushPixels.length){setPanel("paint");setAnnouncement("Add or clear your pixel preview before traveling. Your pixels are still here.");return;}
    closePanel();setPending(null);setMapCamera(cameraView.current);setPanel("world");setCommand(old=>({key:old.key+1,type:"fit"}));
  };
  const visitArea = (area:WorldArea) => {
    if(busy)return;
    if(brushPixels.length){setPanel("paint");setAnnouncement("Add or clear your pixel preview before traveling. Your pixels are still here.");return;}
    closePanel();setPending(null);setActiveScene(sceneForPoint(area.x+area.width/2,area.y+area.height/2));cameraTo([area],"frame");
    setAnnouncement("");requestAnimationFrame(()=>document.querySelector<HTMLElement>(".world-location")?.focus({preventScroll:true}));
  };
  const visitMapPoint = (point:{x:number;y:number}) => {
    const nearby=areaAtPoint(areas,point);if(nearby){visitArea(nearby);return;}
    closePanel();setPending(null);setActiveScene(sceneForPoint(point.x,point.y));cameraTo([{x:point.x-400,y:point.y-300,width:800,height:600}],"frame");
    requestAnimationFrame(()=>document.querySelector<HTMLElement>(".world-location")?.focus({preventScroll:true}));
  };
  const startPlace = () => {
    if(!world||busy)return;
    if(brushPixels.length){setPanel("paint");setAnnouncement("Add or clear your pixel preview before starting a place.");return;}
    if(draft&&(draft.editId||draft.inspiredBy||draft.paintOperationId||draft.title.trim()||draft.body.trim()||draft.url.trim()||draft.file||draft.assetId||draft.previewUrl)){
      resumeDraft();setAnnouncement("Your draft is still here. Finish it before starting another place.");return;
    }
    const view=cameraView.current,anchor=view?screenToWorld(view,{x:view.width/2,y:view.height/2}):{x:0,y:0};
    const ground=newPlaceGround(areas,world.memories,world.pixels,anchor);
    if(!ground){setAnnouncement("No open ground was found nearby. You can still add to an existing place.");return;}
    startBuildHere();setJoinedBuildId(null);setActiveScene(sceneForPoint(ground.x,ground.y));cameraTo([ground],"frame");
    setAnnouncement("You’re on open ground. Name what you’re making and invite someone to help.");
  };
  const openShare = (memory?: Memory) => {
    const view = cameraView.current;
    const place = memory ? sharedPlaceForOriginal(memory, memorySize(memory), view?.z ?? 1) : view ? sharedPlaceFromCamera(view) : null;
    if (!place) { setAnnouncement("Move back inside the drawing area to share a spot."); return; }
    setSharePlace(place); setPanel("share"); setArrival(null); setFormError("");
  };
  const startMemory = (inspiredBy?: string, paintOperationId?: string, type: MemoryType = "text") => {
    setAnnouncement("");
    setArrival(null);
    setDraft({ ...newDraft(inspiredBy, paintOperationId), type }); setPending(null); setPanel("compose"); setBackToSearch(false); setBackToDraft(false); setFormError("");
    const original = world?.memories.find((memory) => memory.id === inspiredBy);
    if (original) { setActiveScene(original.sceneId); setSelectedId(original.id); focusNeighborhood(original,"compose"); }
    else setSelectedId(null);
  };
  const showPaint = () => {
    setJoinedBuildId(null);
    setArrival(null);
    setAnnouncement("");
    setPanel("paint"); setPending(null); setSelectedId(null); setBackToSearch(false); setBackToDraft(false); setFormError("");
    const view = cameraView.current;
    if (paintMode === "draw" && view && view.z < 1.7) setCommand(old => ({ key: old.key + 1, type: "restore", camera: { ...view, ...zoomCameraAt(view, 1.7 / view.z, { x: view.width / 2, y: view.height / 2 }) } }));
  };
  const startBuildHere = () => {
    startMemory();setDraft(current=>current?{...current,isBuildInvitation:true}:current);
  };
  const paintInBuild = () => {
    if(!selected?.isBuildInvitation)return;
    showPaint();setJoinedBuildId(selected.id);setPaintMode("draw");
    const size=memorySize(selected);
    cameraTo([{x:selected.x-80,y:selected.y-130,width:size.width+360,height:size.height+260}],"frame");
  };
  const respondToBuild = (type:MemoryType) => {
    if(!selected?.isBuildInvitation)return;
    if(draft&&!draft.editId&&draft.inspiredBy===selected.id&&draft.type===type)resumeDraft();
    else startMemory(selected.id,undefined,type);
  };
  const useLandmarkTool = (tool:"paint"|"text"|"image") => {
    if(tool==="paint")showPaint();else startMemory(undefined,undefined,tool);
    setActiveScene(landmark.sceneId);
    cameraTo([{x:landmark.x,y:landmark.y,width:landmark.width,height:landmark.height}],"frame");
  };
  const resumeDraft = () => {
    setPanel("compose"); setPending(null); setBackToDraft(false); setBackToSearch(false);
    const original=world?.memories.find(memory=>memory.id===draft?.inspiredBy);
    setSelectedId(original?.id??null);
    if(original){setActiveScene(original.sceneId);focusNeighborhood(original,"compose");}
  };
  const closePanel = useCallback(() => { setArrival(null); setBackToDraft(false); setPanel(null); setSelectedId(null); setBackToSearch(false); setDeleteConfirm(false); setFormError(""); },[]);
  const closeStoryPreview=useCallback(()=>{
    const invoker=previewInvoker.current;
    closePanel();
    requestAnimationFrame(()=>{
      const box=invoker?.getBoundingClientRect();
      const visible=invoker?.isConnected&&box&&box.width>0&&box.height>0&&box.right>0&&box.left<innerWidth&&box.bottom>0&&box.top<innerHeight&&!invoker.closest("[hidden],[inert]")&&!(invoker instanceof HTMLButtonElement&&invoker.disabled);
      (visible?invoker:document.querySelector<HTMLElement>(".wander-button"))?.focus({preventScroll:true});
    });
  },[closePanel]);
  const cancelPlacement = useCallback(() => { if (busy) return; setPending((previous) => { setPanel(previous?.kind === "memory" ? "compose" : "paint"); return null; }); setFormError(""); setAnnouncement(""); }, [busy]);

  const previewMemory = () => {
    if (!draft || !world) return;
    setFormError("");
    if (draft.isBuildInvitation && !draft.body.trim()) { setFormError("Say what people can help make."); return; }
    if (draft.type === "text" && !draft.body.trim()) { setFormError("Leave a few words before choosing a spot."); return; }
    if (draft.type === "image" && !draft.previewUrl) { setFormError("Choose an image to leave in the box."); return; }
    if (draft.type === "image" && draft.file && (!/^image\/(png|jpeg|webp)$/.test(draft.file.type) || draft.file.size > 5 * 1024 * 1024)) { setFormError("Choose a PNG, JPEG, or WebP smaller than 5 MB."); return; }
    if (draft.type === "link") {
      try { const url = new URL(draft.url); if (!["https:", "http:"].includes(url.protocol)) throw new Error(); }
      catch { setFormError("Add a complete http or https link."); return; }
    }
    if (draft.type === "link" && !draft.title.trim() && !draft.body.trim()) { setFormError("Add a title or a little context so someone can find this."); return; }
    if (draft.editId) { void saveEdit(); return; }
    const view = cameraView.current, anchor = view ? screenToWorld(view, { x: view.width / 2, y: view.height / 2 }) : undefined;
    const point = suggestedSpot(world.memories, activeScene, draft.type, parent, anchor);
    const size = memorySize({ type: draft.type });
    setPending({ kind: "memory", ...point, sceneId: sceneForPoint(point.x+size.width/2,point.y+size.height/2) }); setPanel(null);
    cameraTo(parent ? [{ ...parent, ...memorySize(parent) }, { ...point, ...size }] : [{ ...point, ...size }], parent ? "frame" : "focus");
    setAnnouncement("A place is suggested. Tap the world to move it, then leave it here.");
  };
  const startPaintPlacement = () => {
    const view=cameraView.current,anchor=view?screenToWorld(view,{x:view.width/2,y:view.height/2}):active;
    const size={width:SHAPES[shape].rows[0].length*GRID_SIZE,height:SHAPES[shape].rows.length*GRID_SIZE};
    const point=clampMemoryPoint(Math.round((anchor.x-size.width/2)/GRID_SIZE)*GRID_SIZE,Math.round((anchor.y-size.height/2)/GRID_SIZE)*GRID_SIZE,size);
    setPending({ kind: "paint", ...point, shape, color: paintColor, opId: crypto.randomUUID() }); setPanel(null); setFormError("");
    cameraTo([{ ...point, ...size }], "frame"); setAnnouncement("Choose a spot for these pixels, then paint them into the shared picture.");
  };
  const updatePosition = useCallback((x: number, y: number, center = true) => {
    if (busy) return;
    setPending((old) => {
      if (!old) return old;
      const size = old.kind === "paint" ? { width: SHAPES[old.shape].rows[0].length * 6, height: SHAPES[old.shape].rows.length * 6 } : memorySize({ type: draft?.type ?? "text" });
      const point = clampMemoryPoint(Math.round((x - (center ? size.width / 2 : 0)) / GRID_SIZE) * GRID_SIZE, Math.round((y - (center ? size.height / 2 : 0)) / GRID_SIZE) * GRID_SIZE, size);
      return old.kind === "paint" ? { ...old, ...point, opId: crypto.randomUUID() } : { ...old, ...point, sceneId: sceneForPoint(point.x + size.width / 2, point.y + size.height / 2) };
    });
  }, [busy, draft?.type]);

  const publish = useCallback(async () => {
    if (!pending || !world || !identity || busy) return;
    if (!canWrite) { setFormError("Reconnect to the live world before leaving this. Your draft is still here."); return; }
    setFormError("");
    try {
      if (pending.kind === "paint") {
        if(paintWait>0){setFormError(`Next move in ${paintWait}s. Keep arranging your preview.`);return;}
        if (world.paintingPaused) throw new Error("Painting is paused for a moment. You can still leave a memory.");
        setBusy("Saving pixels…");
        const cells = shapePixels(pending.shape, pending.color, pending.x, pending.y);
        const result = await api<{ operationId: string } & PaintTurnTiming>("/api/paint", { method: "POST", body: JSON.stringify({ opId: pending.opId, sceneId: sceneForPoint(pending.x + 36, pending.y + 36), cells }) });
        acceptPaintTurn(result);
        setLastPaint({operationId:result.operationId,buildId:joinedBuildId}); await refresh(); setPending(null); setPanel("paint"); setActiveScene(sceneForPoint(pending.x + 36, pending.y + 36));
        setContribution(paintContributionMark(result.operationId, cells));
        setAnnouncement(`${cells.length} ${cells.length === 1 ? "pixel" : "pixels"} added to the canvas.`);
      } else if (draft) {
        let assetId = draft.assetId;
        if (draft.type === "image" && draft.file && !assetId) { setBusy("Uploading your image…"); assetId = await uploadImage(draft.file); setDraft((old) => old?.clientId === draft.clientId ? { ...old, assetId } : old); }
        setBusy("Leaving your memory…");
        const body: NewMemory = { clientId: draft.clientId, type: draft.type, title: draft.title.trim(), body: draft.body.trim(), color: draft.color, x: pending.x, y: pending.y, sceneId: pending.sceneId, ...(draft.isBuildInvitation?{isBuildInvitation:true}:{}), ...(draft.type === "link" ? { url: draft.url.trim() } : {}), ...(draft.type === "image" && assetId ? { assetId } : {}), ...(draft.inspiredBy ? { inspiredBy: draft.inspiredBy } : {}), ...(draft.paintOperationId ? { paintOperationId: draft.paintOperationId } : {}) };
        const result = await api<Memory | { memory: Memory }>("/api/memories", { method: "POST", body: JSON.stringify(body) });
        const saved = "memory" in result ? result.memory : result;
        const current = await refresh();
        const visible = current?.memories.some(memory => memory.id === saved.id);
        setPending(null); setPanel(visible && !saved.inspiredBy ? "inspect" : null); setSelectedId(visible ? saved.id : null); setActiveScene(saved.sceneId); setJustPublished(saved.id); setDraft(null); setBackToSearch(false); setBackToDraft(false);
        if(visible&&current&&saved.inspiredBy&&cameraView.current){const view=cameraView.current;const camera=neighborhoodCamera({...saved,...memorySize(saved)},current.memories.map(m=>({...m,...memorySize(m)})),view);setCommand(old=>({key:old.key+1,type:"restore",camera:{...view,...camera}}));}
        setContribution(memoryContributionMark(saved));
        setAnnouncement(!current ? "Saved. Reconnecting to show it." : draft.inspiredBy ? "Added, with a link to the original." : "Added to the canvas.");
      }
    } catch (cause) { if(pending.kind==="paint")handlePaintRejection(cause);setFormError(cause instanceof Error ? cause.message : "This didn’t save. Your draft is still here."); }
    finally { setBusy(""); }
  }, [pending, world, identity, busy, canWrite, draft, refresh,paintWait,acceptPaintTurn,handlePaintRejection,joinedBuildId]);

  async function saveEdit() {
    if (!draft?.editId || busy) return;
    setBusy("Saving changes…"); setFormError("");
    try {
      await api(`/api/memories/${draft.editId}`, { method: "PATCH", body: JSON.stringify({ expectedVersion: draft.expectedVersion, title: draft.title.trim(), body: draft.body.trim(), url: draft.type === "link" ? draft.url.trim() : null, color: draft.color, isBuildInvitation:!!draft.isBuildInvitation }) });
      const current = await refresh();
      const visible = current?.memories.some(memory => memory.id === draft.editId);
      setSelectedId(visible ? draft.editId : null); setPanel(visible ? "inspect" : null); setDraft(null); setBackToDraft(false); setAnnouncement(current ? "Your memory has been updated." : "Saved. Reconnecting to show it.");
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : "These changes didn’t save. Try again."); }
    finally { setBusy(""); }
  }
  async function deleteMemory(memory: Memory) {
    setBusy("Removing memory…"); setFormError("");
    try { await api(`/api/memories/${memory.id}`, { method: "DELETE" }); await refresh(); setDeleteConfirm(false); closePanel(); setAnnouncement("Your memory was removed. Contributions that built on it keep their own authors."); }
    catch (cause) { setFormError(cause instanceof Error ? cause.message : "The memory couldn’t be removed. Try again."); }
    finally { setBusy(""); }
  }
  async function undoPaint() {
    if (!lastPaint || busy) return;
    setBusy("Undoing pixels…"); setFormError("");
    try { await api("/api/paint/undo", { method: "POST", body: JSON.stringify({ operationId: lastPaint.operationId }) }); await refresh(); setLastPaint(null); setAnnouncement("Your last paint was undone. Other people’s later changes stay in place."); }
    catch (cause) { setFormError(cause instanceof Error ? cause.message : "That paint couldn’t be undone."); }
    finally { setBusy(""); }
  }
  const changeBrush = (cells: Pixel[]) => { setBrushPixels(mergePaintCells([], cells)); brushOperation.current = null; setFormError(""); setAnnouncement(""); };
  const clearBrush = () => { setBrushPixels([]); brushOperation.current = null; setFormError(""); setAnnouncement("Your preview is cleared. The shared picture is unchanged."); };
  async function publishBrush() {
    if (!brushPixels.length || busy || !world) return;
    if(paintWait>0){setFormError(`Next move in ${paintWait}s. Your preview is still here.`);return;}
    if (!canWrite) { setFormError("Reconnect before sharing these pixels. Your preview is still here."); return; }
    if (world.paintingPaused) { setFormError("Painting is paused. Your preview is still here."); return; }
    setBusy("Saving pixels…"); setFormError("");
    const opId = brushOperation.current ?? crypto.randomUUID(); brushOperation.current = opId;
    try {
      const middle = brushPixels[Math.floor(brushPixels.length / 2)];
      const result = await api<{ operationId: string } & PaintTurnTiming>("/api/paint", { method: "POST", body: JSON.stringify({ opId, sceneId: sceneForPoint(middle.x * GRID_SIZE, middle.y * GRID_SIZE), cells: brushPixels.map(({ x, y, color }) => ({ x, y, color })) }) });
      acceptPaintTurn(result);
      setLastPaint({operationId:result.operationId,buildId:joinedBuildId}); setBrushPixels([]); brushOperation.current = null; await refresh();
      setContribution(paintContributionMark(result.operationId, brushPixels));
      setAnnouncement(`${brushPixels.length} ${brushPixels.length === 1 ? "pixel" : "pixels"} added to the canvas.`);
    } catch (cause) { handlePaintRejection(cause);setFormError(cause instanceof Error ? cause.message : "These pixels didn’t save. Your preview is still here."); }
    finally { setBusy(""); }
  }
  const changeQuery = (text: string) => {
    ++searchSequence.current;
    setQuery(text); setSearchBusy(false); setSearchData(null); setSearchError("");
  };
  const runSearch = async (mode = searchMode, text = query, searchScope = scope) => {
    const sequence = ++searchSequence.current;
    setSearchBusy(false); setSearchData(null); setShowAllSources(false);
    setPanel("search"); setPending(null); setSelectedId(null); setBackToSearch(false); setSearchMode(mode); setQuery(text); setScope(searchScope); setSearchError(""); setAnswerInvalid(false);
    if (!text.trim()) return;
    if (connectionRef.current !== "live") { setSearchError("Reconnect to the live world to find current memories. Your question is still here."); return; }
    setSearchBusy(true);
    try {
      const response = await api<SearchResponse | AnswerResponse>(mode === "ask" ? "/api/ask" : "/api/search", { method: "POST", body: JSON.stringify({ query: text.trim(), ...(searchScope === "scene" ? { sceneId: activeScene } : {}) }) });
      if (sequence !== searchSequence.current) return;
      if (mode === "ask" && connectionRef.current !== "live") { setSearchError("The connection changed while the box was reading. Reconnect and ask again."); return; }
      setSearchData(response); void refresh();
      if (panelRef.current === "search") {
        if (response.results.length) cameraTo(response.results.map(({ memory }) => ({ ...memory, ...memorySize(memory) })), "frame");
        if (mode === "ask") requestAnimationFrame(() => { if (panelRef.current === "search") panelScroller.current?.querySelector(".answer-box")?.scrollIntoView({ block: "nearest", behavior: "instant" }); });
        setAnnouncement(response.results.length ? `Found ${response.results.length} original contributions. Open one to see who left it.` : "No close memories were found. Try another phrase or leave the first one.");
      }
    } catch (cause) { if (sequence === searchSequence.current) setSearchError(cause instanceof Error ? cause.message : "The box couldn’t finish this search. Try again."); }
    finally { if (sequence === searchSequence.current) setSearchBusy(false); }
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (busy) return;
      if (event.key === "Escape") { if (pending) cancelPlacement(); else if(!panel&&selectedId)closeStoryPreview();else closePanel(); return; }
      if (event.target instanceof HTMLElement && (event.target.closest("input,textarea,select,[contenteditable=true]"))) return;
      if (event.key === "/") { event.preventDefault(); keepInputFocus.current=true;setPanel("search");requestAnimationFrame(()=>searchInput.current?.focus()); return; }
      if (!pending || busy) return;
      const steps: Record<string, [number, number]> = { ArrowLeft: [-6, 0], ArrowRight: [6, 0], ArrowUp: [0, -6], ArrowDown: [0, 6] };
      if (steps[event.key]) { event.preventDefault(); const step = steps[event.key]; updatePosition(pending.x + step[0], pending.y + step[1], false); }
      else if (event.key === "Enter" && !(event.target instanceof Element && event.target.closest("button"))) { event.preventDefault(); void publish(); }
    };
    window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler);
  }, [pending, busy, publish, updatePosition, cancelPlacement,panel,selectedId,closeStoryPreview,closePanel]);

  const pendingVisual = useMemo<PendingPlacement | null>(() => {
    if (!pending) return null;
    if (pending.kind === "paint") return { kind: "paint", x: pending.x, y: pending.y, pixels: shapePixels(pending.shape, pending.color, pending.x, pending.y) };
    if (!draft) return null;
    return { kind: "memory", x: pending.x, y: pending.y, memory: { id: "draft", authorId: identity?.id ?? null, authorName: identity?.name ?? "you", type: draft.type, title: draft.title, body: draft.body, url: draft.url || null, imageUrl: draft.previewUrl, color: draft.color, x: pending.x, y: pending.y, sceneId: pending.sceneId, inspiredBy: draft.inspiredBy ?? null, paintOperationId: draft.paintOperationId ?? null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1, indexStatus: "pending", isSeed: false, isBuildInvitation:draft.isBuildInvitation } };
  }, [pending, draft, identity]);

  const openProfile = () => { setProfileName(identity?.name ?? ""); setPanel("profile"); setFormError(""); setPending(null); };
  const saveProfile = async (event: FormEvent) => {
    event.preventDefault(); setBusy("Saving name…"); setFormError("");
    try {
      const result = await api<SessionIdentity | { identity?: SessionIdentity }>("/api/profile", { method: "POST", body: JSON.stringify({ name: profileName.trim() }) });
      const saved = "identity" in result ? result.identity : "id" in result ? result : undefined;
      setIdentity((old) => saved ?? (old ? { ...old, name: profileName.trim() } : old));
      await getBrowserSupabase().auth.updateUser({ data: { name: profileName.trim() } });
      await refresh(); setPanel(null); setAnnouncement(`You’ll leave your next contribution as @${profileName.trim()}.`);
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : "Your name didn’t save. Try again."); }
    finally { setBusy(""); }
  };
  const report = async (event: FormEvent) => {
    event.preventDefault(); setBusy("Sending report…"); setFormError("");
    try { await api("/api/reports", { method: "POST", body: JSON.stringify({ memoryId: reportId, reason: reportReason.trim() }) }); closePanel(); setReportReason(""); setAnnouncement("Report received. Thank you for helping look after this place."); }
    catch (cause) { setFormError(cause instanceof Error ? cause.message : "Your report didn’t send. Try again."); }
    finally { setBusy(""); }
  };

  function renderInspector() {
    if (!selected) return <div className="empty-state"><Leaf size={28} /><h3>This memory isn’t here anymore.</h3><p>It may have been removed by its author. The rest of the world is still here to explore.</p>{backToDraft && draft ? <button type="button" className="button button-secondary" onClick={resumeDraft}><ArrowLeft size={15} />Back to your draft</button> : null}{backToSearch ? <button type="button" className="button button-secondary" onClick={returnToSearch}><ArrowLeft size={15} />Back to {searchMode === "ask" ? "answer" : "results"}</button> : null}</div>;
    const original = world?.memories.find((memory) => memory.id === selected.inspiredBy), descendants = world?.memories.filter((memory) => memory.inspiredBy === selected.id) ?? [];
    const own = !!identity && selected.authorId === identity.id;
    return <div className="inspector">
      {backToSearch ? <button type="button" className="text-button back-link" onClick={returnToSearch}><ArrowLeft size={14} />Back to {searchMode === "ask" ? "answer" : "results"}</button> : null}
      {backToDraft && draft ? <button type="button" className="text-button back-link" onClick={() => { resumeDraft(); setActiveScene(draftScene.current); }}><ArrowLeft size={14} />Back to your draft</button> : null}
      {justPublished === selected.id ? <p className="success-label"><Check size={16} />Published</p> : null}
      <div className="original-meta"><span>{selected.type}</span><span>@{selected.authorName}</span>{selected.isSeed ? <span className="seed-label">Starter memory</span> : null}</div>
      <h3 className="original-title">{selected.title || selected.body.slice(0, 72)}</h3>
      {original ? <div className="lineage"><span>Built on a memory by @{original.authorName}</span><button type="button" onClick={() => openMemory(original.id, backToSearch)}>{original.title || original.body.slice(0, 48)}<ArrowUpRight size={14} /></button></div> : selected.inspiredBy ? <p className="fine-print">The original that inspired this memory is no longer available.</p> : null}
      {selected.type === "image" && selected.imageUrl ? <div className="original-image"><img src={selected.imageUrl} alt={selected.title || "A contribution to Memory Box"} /></div> : null}
      {selected.body ? <div className="original-body">{selected.body}</div> : null}
      {selected.type === "link" && selected.url ? <a className="original-url" href={selected.url} target="_blank" rel="noopener noreferrer"><Link2 size={15} />{new URL(selected.url).hostname}<ArrowUpRight size={14} /></a> : null}
      <div className="panel-actions"><button type="button" className="button button-primary" onClick={() => selected.isBuildInvitation?joinBuild(selected.id):startMemory(selected.id)}>{selected.isBuildInvitation?<UsersRound size={16}/>:<GitBranch size={16}/>} {selected.isBuildInvitation?"Join this build":"Build on this"}</button><button type="button" className="button button-secondary" onClick={() => { void runSearch("find", selected.title || selected.body.slice(0, 70), "all"); }}>Find connections</button></div>
      <button type="button" className="text-button show-in-world" onClick={() => { setPanel(null); cameraTo([{ ...selected, ...memorySize(selected) }]); revealCanvas(); }}><MapPin size={14} />Show in canvas<ArrowUpRight size={13} /></button>
      <button type="button" className="text-button share-original" onClick={() => openShare(selected)}><Link2 size={14} />Share original</button>
      <div className="original-date">Left {relativeDate(selected.createdAt)}</div>
      {selected.isSeed ? <p className="seed-disclosure">Fictional example.</p> : null}
      {selected.indexStatus === "pending" ? <p className="index-status"><span className="spinner" />Finding its connections. Your words are already searchable.</p> : selected.indexStatus === "failed" ? <p className="index-status">Your words are searchable. Finding deeper connections will retry.</p> : null}
      {descendants.length ? <div className="descendants"><h4>{descendants.length === 1 ? "1 contribution builds on this" : `${descendants.length} contributions build on this`}</h4>{descendants.map((memory) => <MemoryResult key={memory.id} memory={memory} onOpen={() => openMemory(memory.id, backToSearch)} />)}</div> : null}
      {own ? <div className="owner-actions">
        <button type="button" className="text-button" onClick={() => {
          setDraft({ ...newDraft(selected.inspiredBy ?? undefined), editId: selected.id, expectedVersion: selected.version, type: selected.type, title: selected.title, body: selected.body, color: selected.color, url: selected.url ?? "", previewUrl: selected.imageUrl, isBuildInvitation:!!selected.isBuildInvitation });
          setPanel("compose"); setFormError("");
        }}><Pencil size={13} />Edit memory</button>
        <button type="button" className="text-button danger-text" onClick={() => setDeleteConfirm(true)}><Trash2 size={13} />Remove</button>
      </div> : <button type="button" className="text-button report-link" onClick={() => { setReportId(selected.id); setReportReason(""); setFormError(""); setPanel("report"); }}><Flag size={12} />Report this memory</button>}
      {deleteConfirm ? <div className="confirm-box"><strong>Remove your memory?</strong><p>It will leave the canvas and search. Other people’s contributions will stay.</p><div><button type="button" className="button button-danger" disabled={!!busy || !canWrite} onClick={() => void deleteMemory(selected)}>{busy || "Remove memory"}</button><button type="button" className="button button-secondary" onClick={() => setDeleteConfirm(false)}>Keep it</button></div></div> : null}
      {formError ? <p className="form-error" role="alert">{formError}</p> : null}
    </div>;
  }

  function renderSearch() {
    const searchData = currentSearchData;
    const answer = isAnswer(searchData) ? searchData : null;
    const resultIds = searchData?.results.map((result) => result.memory.id) ?? [];
    const visibleResults = answer && !showAllSources ? searchData!.results.slice(0, 3) : searchData?.results ?? [];
    const citationCount = answer ? citedSourceCount(answer.claims, world?.memories ?? []) : 0;
    return <div className="search-panel">
      <div className="search-settings"><div className="mode-switch"><button type="button" aria-pressed={searchMode === "find"} onClick={() => { setSearchMode("find"); changeQuery(query); }}><Search size={14} />Find</button><button type="button" aria-pressed={searchMode === "ask"} onClick={() => { setSearchMode("ask"); changeQuery(query); }}><MessageCircle size={14} />Ask</button></div><label className="scope-label"><span className="visually-hidden">Search scope</span><select value={scope} onChange={(event) => void runSearch(searchMode, query, event.target.value as "all" | "scene")}><option value="all">Whole box</option><option value="scene">This scene</option></select><ChevronDown size={12} /></label></div>
      <form className="panel-search-form" onSubmit={(event) => { event.preventDefault(); void runSearch(); }}><label className="visually-hidden" htmlFor="panel-query">{searchMode === "ask" ? "Question for the box" : "Search memories"}</label><textarea ref={searchInput} id="panel-query" rows={2} value={query} onChange={(event) => changeQuery(event.target.value)} placeholder={searchMode === "ask" ? "Ask about what people have left…" : "Search notes, photos and ideas…"} maxLength={400} /><button type="submit" aria-label={searchMode === "ask" ? "Ask the box" : "Find memories"} disabled={searchBusy}><ArrowRight size={24} /></button></form>
      {searchBusy ? <div className="search-loading"><span className="spinner" /><strong>{searchMode === "ask" ? "Finding sources…" : "Searching…"}</strong></div> : null}
      {searchError ? <div className="notice notice-error" role="alert"><p>{searchError}</p><button type="button" className="text-button" onClick={() => void runSearch()}>Try again<ArrowRight size={13} /></button></div> : null}
      {searchData && !searchBusy ? <>
        {answer ? effectiveAnswerInvalid || connection !== "live" ? <div className="answer-box stale-answer"><WifiOff size={17} /><h3>{effectiveAnswerInvalid ? "One of these memories changed." : "This answer needs a fresh look."}</h3><p>{effectiveAnswerInvalid ? "Read the current originals, or ask again to make a new connection." : "Reconnect before reading a generated answer. Your question is still here."}</p><button type="button" className="text-button" onClick={() => void runSearch("ask")}>Ask again<ArrowRight size={13} /></button></div> : answer.status === "answered" ? <div className="answer-box"><div className="answer-label"><Sparkles size={14} />Based on {citationCount} contribution{citationCount === 1 ? "" : "s"}</div>{answer.claims.map((claim, index) => <p key={index}>{claim.text} {claim.sourceIds.filter((id) => resultIds.includes(id)).map((id) => <button type="button" key={id} className="citation" data-source-id={id} aria-label={`Open source ${resultIds.indexOf(id) + 1}`} onClick={() => openMemory(id, true)}>{resultIds.indexOf(id) + 1}</button>)}</p>)}{answer.summary ? <p className="answer-summary">{answer.summary}</p> : null}<span className="answer-footnote">Selected passages and recorded connections. The originals are always one click away.</span></div> : <div className="answer-box"><CircleHelp size={20} /><h3>{answer.status === "insufficient" ? "The box doesn’t have enough here yet." : "The box couldn’t finish this answer."}</h3><p>{answer.summary || "Try a smaller question, browse the originals, or leave the first memory about it."}</p></div> : null}
        <div className="sources-heading"><h3>{searchData.results.length} original{searchData.results.length === 1 ? "" : "s"}{searchMode === "ask" ? " to read" : " found"}</h3>{searchData.results.length ? <button type="button" className="text-button" onClick={() => { searchCamera.current = cameraView.current ? { ...cameraView.current } : null; setPanel(null); setBackToSearch(true); cameraTo(searchData.results.map(({ memory }) => ({ ...memory, ...memorySize(memory) })), "frame"); revealCanvas(); }}>Show on canvas<ArrowUpRight size={12} /></button> : null}</div>
        <div className={`search-results${answer ? " source-list" : ""}`}>{visibleResults.map((result, index) => <div key={result.memory.id}><MemoryResult memory={result.memory} index={index} onOpen={() => openMemory(result.memory.id, true)} match={!answer ? searchDataRef.current?.results.find((snapshot) => snapshot.memory.id === result.memory.id)?.memory.version !== result.memory.version ? "Updated since this search" : result.match === "semantic" ? "Connected by meaning" : result.match === "both" ? "Words + meaning" : "Matched your words" : undefined} />{!answer ? <p className="search-excerpt">{result.memory.body.slice(0, 190)}{result.memory.body.length > 190 ? "…" : ""}</p> : null}</div>)}</div>
        {answer && searchData.results.length > 3 ? <button type="button" className="text-button source-expander" aria-expanded={showAllSources} onClick={() => setShowAllSources(!showAllSources)}>{showAllSources ? "Show fewer originals" : `Show all ${searchData.results.length} originals`}<ChevronDown size={13} /></button> : null}
        {!searchData.results.length && !answer ? <div className="empty-state compact"><Search size={25} /><h3>No close memories yet.</h3><p>Try a different phrase or leave the first contribution about it.</p></div> : null}
        {searchData.notice ? <p className="search-notice">{searchData.notice}</p> : null}
      </> : null}
      {!searchBusy && !searchData && !searchError ? <p className="search-invitation">{searchMode === "ask" ? "Answers link to the original contributions." : "Search by words or meaning."}</p> : null}
      {!searchBusy ? <div className="search-suggestions"><span>Try</span>{(campusAvailable ? searchMode === "ask" ? ["What have people left about campus geese?", "What small Waterloo moments do people remember?"] : ["pink tie", "co-op waiting", "late campus"] : searchMode === "ask" ? ["What have people shared about music and family?", "What ideas mention places to meet?"] : ["childhood car rides", "a quiet place to sit", "unfinished ideas"]).map((text) => <button type="button" key={text} onClick={() => void runSearch(searchMode, text, "all")}>{text}<ArrowUpRight size={16} /></button>)}</div> : null}
    </div>;
  }

  function renderPaint() {
    if (!world) return null;
    const events = world.events.filter(event => event.kind === "paint" && !event.isSeed).slice(0, 3);
    return <div className="paint-panel">
      {joinedBuildId?<button type="button" className="joined-build-return" aria-label="Back to build" onClick={()=>joinBuild(joinedBuildId)}><UsersRound size={18}/><span><strong>Back to build</strong><small>{joinedBuild?originalLabel(joinedBuild):"Original unavailable"}</small></span><ArrowUpRight size={15}/></button>:null}
      <PaintKit mode={paintMode} onMode={mode => { setPaintMode(mode); setAnnouncement(""); if (mode === "draw") revealCanvas(); }} shape={shape} onShape={setShape} color={paintColor} onColor={setPaintColor} />
      <div className="paint-turn-status" data-paint-wait={paintWait}><span className="turn-light" aria-hidden="true"/><div><strong>{paintWait>0?`Next save in ${paintWait}s`:paintTurnKnown?"Ready to paint":"Checking your turn…"}</strong><small>144 pixels per save · 15-second turns</small></div><progress max={15} value={15-paintWait} aria-label="Paint turn recharge"/></div>
      {paintMode === "draw" ? <>
        <div className="brush-summary"><strong className="paint-preview-count">{brushPixels.length} / 144 pixels</strong><p className="panel-copy">Draw a preview, then add it to the shared canvas.</p></div>
        <div className="paint-actions"><button type="button" className="button button-primary" onClick={() => void publishBrush()} disabled={!brushPixels.length || !!busy || !canWrite || world.paintingPaused || paintWait>0}>{busy || (paintWait>0?`Next move in ${paintWait}s`:"Add my pixels")}<Check size={15} /></button><button type="button" className="button button-secondary" onClick={clearBrush} disabled={!brushPixels.length || !!busy}>Clear preview</button></div>
        <button type="button" className="text-button" onClick={revealCanvas}><Paintbrush size={16} />Draw on canvas<ArrowUpRight size={16} /></button>
      </> : <div className="paint-kit-place"><button type="button" className="button button-primary button-full" onClick={startPaintPlacement} disabled={world.paintingPaused}>Choose its place<ArrowRight size={16} /></button></div>}
      {world.paintingPaused ? <p className="form-error">Painting is paused for a moment. Memories are still open.</p> : null}
      {lastPaint ? <div className="paint-state"><p className="success-label"><CheckCheck size={16} />Your last pixels are shared.</p><div className="panel-actions"><button type="button" className="button button-secondary" onClick={() => startMemory(lastPaintSource, lastPaint.operationId)}><StickyNote size={15} />Leave the thought behind it</button><button type="button" className="text-button undo-link" disabled={!!busy || !canWrite} onClick={() => void undoPaint()}><Undo2 size={14} />Undo my last paint</button></div></div> : null}
      {events.length ? <><div className="section-label">Recent paint</div><div className="recent-contributors">{events.map(event => <div className="activity-event" key={event.id}><strong>@{event.authorName}</strong><p>{event.description}</p><span>{relativeDate(event.createdAt)}</span></div>)}</div></> : null}
      {formError ? <p className="form-error" role="alert">{formError}</p> : null}
    </div>;
  }

  function renderPanel() {
    if (!world) return null;
    if(panel==="world")return <WorldMap world={world} areas={areas} camera={mapCamera} onVisit={visitArea} onPoint={visitMapPoint} onStart={startPlace} disabled={!!busy}/>;
    if (panel === "share" && sharePlace) return <SharePlacePanel world={world} place={sharePlace} onBack={sharePlace.memoryId && selected ? () => setPanel("inspect") : undefined} />;
    if (panel === "people") return <div className="people-panel">
      <div className="presence-self"><span className="person-avatar">{identity?.name.slice(0,1).toUpperCase() || "Y"}</span><div><strong>{identity?.name || "You"}</strong><small>{presence.connected ? "You’re here" : "Joining live presence…"}</small></div><button type="button" className="text-button" aria-label={`Your profile, ${identity?.name ?? "guest"}`} onClick={openProfile}>Your name<ArrowUpRight size={13}/></button></div>
      {presence.visitors.map(visitor => { const peer=presence.peers.find(p=>p.sessionId===visitor.sessionId);return <div className="presence-visitor" data-peer-id={visitor.sessionId} key={visitor.sessionId}><span className="person-avatar" style={{background:visitor.color}}>{visitor.name.slice(0,1).toUpperCase()}</span><div><strong>{visitor.name}</strong><small>{peer?.tool==="paint" ? "Painting pixels" : peer?.tool==="note" ? "Leaving something" : "Wandering the world"}</small></div>{peer ? <button type="button" className="text-button" aria-label={`Visit ${visitor.name}`} onClick={()=>{closePanel();cameraTo([{x:peer.x-170,y:peer.y-130,width:340,height:260}],"frame");}}>Visit<ArrowUpRight size={13}/></button> : null}</div>; })}
      {presence.connected && !presence.visitors.length ? <div className="quiet-world"><h3>No one else is here.</h3><p>Copy the link to invite someone.</p></div> : null}
      <button type="button" className="button button-primary button-full" onClick={() => openShare()}><MapPin size={16}/>Invite someone here</button>
      <div className="people-links"><button type="button" className="text-button" aria-label="Browse" onClick={()=>{setPanel("browse");setSelectedId(null);setBackToSearch(false);}}><List size={15}/>Browse originals</button><button type="button" className="text-button" onClick={()=>setPanel("activity")}>See what changed<ArrowUpRight size={13}/></button></div>
    </div>;
    if (panel === "together") return <div className="together-panel">
      <button type="button" className="button button-primary button-full" onClick={startBuildHere}><Plus size={16}/>Start a build here</button>
      <div className="open-build-list">{invitations.length?<><h3 className="section-label">Open builds</h3>{invitations.map(memory=><MemoryResult key={memory.id} memory={memory} onOpen={()=>joinBuild(memory.id)}/>)}</>:<p className="panel-copy">No open invitations yet.</p>}</div>
      {presence.peers.some(peer=>peer.tool==="paint")?<button type="button" className="text-button live-build-link" onClick={followLivePainter}><Paintbrush size={16}/>Visit a live painter<ArrowUpRight size={14}/></button>:null}
      <h3 className="panel-lead">{landmark.title}</h3><p className="panel-copy">{landmark.invitation}</p><div className="panel-actions"><button type="button" className="button button-secondary" onClick={()=>useLandmarkTool("paint")}><Paintbrush size={16}/>Paint there</button><button type="button" className="button button-secondary" onClick={()=>useLandmarkTool("text")}>Add a note<Plus size={16}/></button><button type="button" className="text-button" onClick={()=>useLandmarkTool("image")}><ImageIcon size={16}/>Leave a photo</button></div><div className="landmark-paths"><span className="section-label">Other patches</span>{landmarks.map((place,index)=><button type="button" key={place.id} onClick={()=>visitLandmark(index)} aria-pressed={landmarkIndex===index}>{place.title}<ArrowUpRight size={16}/></button>)}</div>
    </div>;
    if(panel==="build")return <BuildWorkbench memory={selected} compact={!!compactBuild} onPaint={paintInBuild} onNote={()=>respondToBuild("text")} onPhoto={()=>respondToBuild("image")} onRead={()=>selected&&openMemory(selected.id)} onShare={()=>selected&&openShare(selected)} onTogether={buildTogether}/>;
    if (panel === "compose" && draft) return <MemoryComposer draft={draft} onChange={next => { setDraft(next); setFormError(""); }} parent={parent} sceneId={activeScene} onSceneChange={setActiveScene} onOriginal={(id) => { draftScene.current = activeScene; openMemory(id, false, true); }} onPreview={previewMemory} busy={busy} error={formError} />;
    if (panel === "inspect") return renderInspector();
    if (panel === "search") return renderSearch();
    if (panel === "paint") return renderPaint();
    if (panel === "scene") { const memories = world.memories.filter((memory) => memory.sceneId === activeScene); return <div><h3 className="panel-lead">{active.title}</h3><div className="panel-actions"><button type="button" className="button button-primary" onClick={showPaint}><Paintbrush size={16} />Paint here</button><button type="button" className="button button-secondary" onClick={() => startMemory(lastPaintSource, lastPaint?.operationId)}><Plus size={16} />Leave a memory</button></div>{lastPaint ? <div className="saved-paint"><CheckCheck size={16} /><div><strong>Pixels saved</strong><button type="button" className="text-button" onClick={() => startMemory(lastPaintSource, lastPaint.operationId)}>Attach a memory<ArrowRight size={16} /></button></div></div> : null}<button type="button" className="text-button scene-ask" onClick={() => void runSearch("ask", `What connects the memories in ${active.title}?`, "scene")}><MessageCircle size={16} />Ask about this scene<ArrowUpRight size={16} /></button><div className="section-label">{memories.length} memories</div>{memories.map((memory) => <MemoryResult key={memory.id} memory={memory} onOpen={() => openMemory(memory.id)} />)}</div>; }
    if (panel === "browse") return <div><label className="field field-inline">Show<select value={scope} onChange={(event) => setScope(event.target.value as "all" | "scene")}><option value="all">Whole box</option><option value="scene">{active.title}</option></select></label>{world.memories.filter((memory) => scope === "all" || memory.sceneId === activeScene).map((memory) => <MemoryResult key={memory.id} memory={memory} onOpen={() => openMemory(memory.id)} />)}{!world.memories.length ? <div className="empty-state"><StickyNote size={24} /><h3>No contributions yet</h3><button type="button" className="button button-primary" onClick={() => startMemory()}>Leave something<Plus size={16} /></button></div> : null}</div>;
    if (panel === "activity") return <div><div className="activity-list">{world.events.map((event) => <div className="activity-event" key={event.id}><span className="activity-dot" /><div><strong>@{event.authorName}</strong><p>{event.description}</p><span>{relativeDate(event.createdAt)}{event.isSeed ? " · starter history" : ""}</span>{event.memoryId ? <button type="button" className="text-button" onClick={() => openMemory(event.memoryId!)}>View original<ArrowUpRight size={16} /></button> : null}</div></div>)}</div>{!world.events.length ? <p className="panel-copy">No recent changes.</p> : null}</div>;
    if (panel === "profile") return <form className="profile-form" onSubmit={saveProfile}><div className="profile-avatar"><UserRound size={32} /></div><label className="field">Your name<input value={profileName} onChange={(event) => setProfileName(event.target.value)} minLength={2} maxLength={24} required autoComplete="nickname" placeholder="Display name" /></label><p className="fine-print">Shown beside your contributions.</p><button type="submit" className="button button-primary button-full" disabled={!!busy || !canWrite}>{busy || "Save my name"}<ArrowRight size={16} /></button>{formError ? <p className="form-error" role="alert">{formError}</p> : null}<p className="fine-print">Guest access is saved in this browser. Clearing browser data removes access to edit your contributions.</p><div className="section-label">Your contributions</div>{world.memories.filter((memory) => memory.authorId === identity?.id).map((memory) => <MemoryResult key={memory.id} memory={memory} onOpen={() => openMemory(memory.id)} />)}</form>;
    if (panel === "report") return <form onSubmit={report}><Flag size={24} className="report-icon" /><h3 className="panel-lead">Help look after this place.</h3><p className="panel-copy">Tell us what needs attention. The contribution will stay in place until it’s reviewed.</p><label className="field">What should we know?<textarea rows={5} value={reportReason} onChange={(event) => setReportReason(event.target.value)} minLength={5} maxLength={500} required placeholder="A short explanation…" /></label><button type="submit" className="button button-primary button-full" disabled={!!busy || !canWrite}>{busy || "Send report"}<Send size={15} /></button>{formError ? <p className="form-error" role="alert">{formError}</p> : null}</form>;
    return null;
  }

  const latestChange = world?.events.find(event=>!event.isSeed && Date.now()-new Date(event.createdAt).getTime()<5*60_000);
  const PanelIcon = panel === "share" ? MapPin : panel === "paint" ? Paintbrush : panel === "people" || panel === "together" || panel === "build" ? UsersRound : panel === "search" ? searchMode === "ask" ? MessageCircle : Search : panel === "profile" ? UserRound : panel === "compose" ? draft?.type === "image" ? ImageIcon : StickyNote : panel === "report" ? Flag : StickyNote;
  const inlineReply=panel==="compose"&&!!parent&&!draft?.editId;
  const inlineBuild=panel==="build"&&!!selected;
  const contextPanel=panel&&world?<aside ref={panelScroller} className={`context-panel panel-${panel}${panelExpanded?" panel-expanded":""}${compactBuild?" is-build-compact":""}`} aria-label={panelTitle}>
    <div className="panel-mobile-handle"/>
    <div className="panel-header">
      <h2 ref={panelHeading} tabIndex={-1}><span className="panel-title-icon">{panel==="world"?<AreaMark emblem="map"/>:panel==="paint"||panel==="compose"||panel==="together"||panel==="build"||panel==="people"?<PixelToolIcon tool={panel==="paint"?"paint":panel==="compose"?draft?.type==="image"?"photo":"note":"together"}/>:<PanelIcon size={24}/>}</span><span className="panel-title-text">{panelTitle}</span></h2>
      {panel==="build"&&selected?.isBuildInvitation?<button type="button" className="icon-button" aria-label={buildCollapsed?"Expand build details":"Collapse build details"} aria-expanded={!buildCollapsed} aria-controls={`build-details-${selected.id}`} onClick={toggleBuildDetails}>{buildCollapsed?<Maximize2 size={16}/>:<Minimize2 size={16}/>}</button>:null}
      {panel==="inspect"?<button type="button" className="icon-button panel-expand" aria-label={panelExpanded?"Collapse panel":"Expand panel"} onClick={()=>setPanelExpanded(!panelExpanded)}>{panelExpanded?<Minimize2 size={16}/>:<Maximize2 size={16}/>}</button>:null}
      <button type="button" className="icon-button" aria-label="Close panel" disabled={!!busy} onClick={closePanel}><X size={18}/></button>
    </div>
    <div className="panel-content" ref={panelContent} inert={!!busy} aria-busy={!!busy}>{renderPanel()}</div>
  </aside>:null;
  const floating=inlineReply&&parent?{anchor:{...parent,...memorySize(parent)},mode:"compose" as const,content:contextPanel}
    :inlineBuild&&selected?{anchor:{...selected,...memorySize(selected)},mode:"compose" as const,content:contextPanel}
    :!panel&&!pending&&selected?{anchor:{...selected,...memorySize(selected)},mode:"peek" as const,content:<StoryPeek memory={selected} onRead={()=>openMemory(selected.id)} onBuild={()=>startMemory(selected.id)} onJoin={()=>joinBuild(selected.id)} onNext={wander} onClose={closeStoryPreview}/>} :undefined;
  return <ToolHints><main className="memory-box-app living-mosaic-app">
    <h1 className="visually-hidden">Memory Box canvas</h1>
    <header className="app-header">
      <button type="button" className="wordmark" aria-label="Memory Box, see the whole commons" disabled={!!busy} onClick={() => { closePanel(); setCommand((old) => ({ key: old.key + 1, type: "fit" })); }}><span className="brand-mark" aria-hidden="true"><BoxMark /></span>memorybox</button>
      <button type="button" className="header-find" aria-label="Find a memory or ask the box" onClick={()=>{setPanel("search");setPending(null);setSelectedId(null);}} disabled={!world || !!busy}><Search size={17}/><span>Find / ask</span><kbd>/</kbd></button>
      <button type="button" className="header-browse icon-button" aria-label="Browse" onClick={()=>{setPanel("browse");setSelectedId(null);}} disabled={!world || !!busy}><List size={17}/></button>
      <button type="button" className="leave-button" aria-label="Leave something" onClick={() => draft ? resumeDraft() : startMemory()} disabled={!world || !!busy}>
        <span className="leave-button-face"><span className="leave-button-icon" aria-hidden="true"><Plus size={16} /></span><span className="leave-button-label">Leave something</span><span className="leave-button-short" aria-hidden="true">Leave</span></span>
      </button>
      <button type="button" className="profile-button" aria-label={`Your profile, ${identity?.name ?? "guest"}`} onClick={openProfile} disabled={!identity || !!busy}><UserRound size={18} /></button>
    </header>
    <div className="world-topbar visually-hidden"><div className={`connection-state ${connection}`}><span />{connection === "live" ? "Live" : connection === "connecting" ? "Connecting" : connection === "reconnecting" ? "Reconnecting" : connection === "offline" ? "Offline" : "Connection paused"}</div></div>
    {worldError && world ? <div className="connection-banner" role="status"><WifiOff size={15} /><span>{worldError} Your draft is safe.</span><button type="button" onClick={retry}>Reconnect</button></div> : null}
    {connection !== "live" && world && !worldError ? <div className="connection-banner" role="status"><WifiOff size={15} /><span>{connection === "offline" ? "You’re offline. This is the last world you saw; reconnect to contribute or ask." : "Reconnecting to the world. Your drafts and question are still here."}</span><button type="button" onClick={retry}>Reconnect</button></div> : null}
    <div className={`app-workspace${panel ? " has-panel" : ""}`}>
      {world ? <div className="world-column"><WorldCanvas world={world} areas={areas} onArea={visitArea} onWorldMap={showWholeWorld} geographyQuiet={!!panel} peers={presence.peers} onCursor={presence.publish} activeScene={activeScene} selectedId={selectedId} foundIds={foundIds} pending={pendingVisual} command={command} onCameraChange={rememberCamera} contribution={contribution} floating={floating} brush={{ enabled: panel === "paint" && paintMode === "draw" && !pending, color: paintColor, cells: brushPixels, disabled: !!busy || world.paintingPaused, onChange: changeBrush }} onScene={(id) => { if (!busy) showScene(id); }} onOpen={(id) => { if (!busy) {if(panel||backToSearch)openMemory(id,panel==="search"||backToSearch);else peekMemory(id);} }} onPosition={updatePosition}>
        <div className="world-social-controls canvas-overlay" role="group" aria-label="People and sharing">
          {!panel && !pending ? <button type="button" className="meet-here-button" onClick={() => openShare()}><MapPin size={18} /><span>Meet here</span></button> : null}
          <button type="button" className="world-presence" aria-label="Who is here" disabled={!!busy} data-presence-connected={presence.connected} data-visitor-count={presence.visitors.length} onClick={()=>{setPanel("people");setPending(null);}}><span className="presence-stack" aria-hidden="true">{presence.visitors.slice(0,3).map(v=><span style={{background:v.color}} key={v.sessionId}>{v.name.slice(0,1).toUpperCase()}</span>)}<span className="self-dot">{identity?.name.slice(0,1).toUpperCase()||"Y"}</span></span><span>{presence.connected ? `${presence.visitors.length+1} here` : "Joining…"}</span><span className={`presence-light ${presence.connected ? "is-live" : ""}`} /></button>
        </div>
        {arrival && !panel && !pending ? <div className="shared-arrival canvas-overlay" aria-label="Shared spot">
          <div className="shared-arrival-heading"><MapPin size={22} /><strong>{arrival.memoryId ? "This original is unavailable" : "You’re at the shared spot"}</strong><button type="button" className="icon-button" aria-label="Dismiss shared spot" onClick={() => setArrival(null)}><X size={16} /></button></div>
          <p>{arrival.memoryId ? "Its spot is still here to explore." : "Paint together, or add something nearby."}</p>
          <div className="arrival-actions"><button type="button" onClick={showPaint}><Paintbrush size={16} />Paint here</button><button type="button" onClick={() => draft ? (setArrival(null), resumeDraft()) : startMemory()}><StickyNote size={16} />{draft ? "Your draft" : "Note"}</button><button type="button" onClick={() => startMemory(undefined, undefined, "image")}><ImageIcon size={16} />Photo</button></div>
        </div> : null}
        {!panel && !pending ? <button type="button" ref={invitationElement} className="mosaic-invitation canvas-overlay" onClick={followLivePainter}><span className="pixel-invite-mark" aria-hidden="true">▪ ▪ ▪</span><span><strong>{presence.peers.some(p=>p.tool==="paint") ? "Someone is making something." : landmark.title}</strong><small>{presence.peers.some(p=>p.tool==="paint") ? "Go paint beside them ↗" : "Make your next move here ↗"}</small></span></button> : null}
        {!panel && latestChange ? <button type="button" className="world-change canvas-overlay" disabled={!!busy} onClick={()=>setPanel("activity")}><span className="presence-light is-live"/><span><strong>{latestChange.authorName}</strong> {latestChange.description}<small>{relativeDate(latestChange.createdAt)}</small></span></button> : null}
        {!pending && backToSearch ? <button type="button" className="button button-secondary search-return canvas-overlay" disabled={!!busy} onClick={returnToSearch}><ArrowLeft size={14} />Back to {searchMode === "ask" ? "answer" : "results"}</button> : null}
        {!pending && brushPixels.length > 0 ? <div className="canvas-paint-bar canvas-overlay" data-paint-wait={paintWait}><span className="paint-preview-count">{brushPixels.length} pixels · preview<small className="compact-turn">{paintWait>0?`Next move in ${paintWait}s · keep sketching`:"144 pixels · 15s turns"}</small></span><label className="brush-color-label"><span className="visually-hidden">Brush color</span><input type="color" value={paintColor} onChange={event => setPaintColor(event.target.value)} aria-label="Brush color" /></label><button type="button" className="button button-primary" aria-label="Share preview pixels" onClick={() => void publishBrush()} disabled={!brushPixels.length || !!busy || !canWrite || world.paintingPaused || paintWait>0}>{busy || (paintWait>0?`${paintWait}s`:"Add pixels")}<Check size={14} /></button><button type="button" className="icon-button" onClick={clearBrush} disabled={!brushPixels.length || !!busy} aria-label="Clear pixel preview"><X size={15} /></button>{formError ? <p className="form-error" role="alert">{formError}</p> : null}</div> : null}
        {pending ? <div className="placement-bar canvas-overlay"><div><strong>{pending.kind === "paint" && paintWait>0?`Next save in ${paintWait}s`:"Choose a position"}</strong><p>Tap to move · arrow keys to nudge</p></div><button type="button" className="button button-primary" onClick={() => void publish()} disabled={!!busy || !canWrite || (pending.kind==="paint"&&paintWait>0)}>{busy ? <><span className="spinner" />{busy}</> : pending.kind === "paint" ? <>Paint here<Check size={16} /></> : <>Leave it here<Check size={16} /></>}</button><button type="button" className="icon-button" aria-label="Cancel placement" onClick={cancelPlacement} disabled={!!busy}><X size={24} /></button>{formError ? <p className="placement-error" role="alert">{formError}</p> : null}</div> : null}
        {!pending ? <CanvasDock><ToolButton disabled={!!busy} label="Explore canvas" className="explore-button" onClick={showWholeWorld}><PixelToolIcon tool="explore" /><span>Explore</span></ToolButton><ToolButton disabled={!!busy} className="wander-button" label="Wander into a story" onClick={wander}><PixelToolIcon tool="wander" /><span>Wander</span></ToolButton><ToolButton disabled={!!busy} className="together-button" label="Build together" aria-pressed={panel==="together"} onClick={buildTogether}><PixelToolIcon tool="together" /><span>Together</span></ToolButton><ToolButton disabled={!!busy} className="paint-button" label="Paint" aria-pressed={panel === "paint"} onClick={showPaint}><PixelToolIcon tool="paint" /><span>Paint</span></ToolButton><ToolButton disabled={!!busy} className="note-button" label="Leave" aria-pressed={panel === "compose" && draft?.type !== "image"} onClick={() => draft ? resumeDraft() : startMemory()}><PixelToolIcon tool="note" /><span>Note</span></ToolButton><ToolButton disabled={!!busy} className="photo-button" label="Leave a photo" aria-pressed={panel === "compose" && draft?.type === "image"} onClick={() => startMemory(undefined, undefined, "image")}><PixelToolIcon tool="photo" /><span>Photo</span></ToolButton></CanvasDock> : null}
      </WorldCanvas></div> : <div className="world-loading"><img src="/favicon.svg" className="loading-mark" width="64" height="64" alt="" /><h2>{worldError ? "Couldn’t load the canvas" : "Loading canvas…"}</h2>{worldError ? <><p>{worldError}</p><button type="button" className="button button-primary" onClick={retry}>Try again<ArrowRight size={24} /></button></> : <span className="spinner" />}</div>}
      {!inlineReply&&!inlineBuild?contextPanel:null}
    </div>
    <div className={`app-announcement${arrival || panel === "share" ? " visually-hidden" : ""}`} role="status" aria-live="polite">{announcement}</div>
  </main></ToolHints>;
}
