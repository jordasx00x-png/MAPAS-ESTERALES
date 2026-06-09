/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Download, Music, MapPin, Calendar, Type, Image as ImageIcon, Loader2, Save, FolderOpen, LogOut, User, ArrowLeft, Plus, Sparkles, Moon, Compass } from 'lucide-react';
import { toPng } from 'html-to-image';
import { auth, db, signInWithGoogle, logout } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, serverTimestamp } from 'firebase/firestore';

// PRNG for consistent map generation based on text inputs
const stringToSeed = (str: string) => {
  let h = 0xdeadbeef;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 2654435761);
  return (h ^ h >>> 16) >>> 0;
};
const mulberry32 = (a: number) => () => {
  var t = a += 0x6D2B79F5;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};

const THEMES = [
  { id: 'obsidian', name: 'Obsidian', bg: 'bg-black', text: 'text-white', lines: '#ffffff', canvas: '#000000', border: 'border-white' },
  { id: 'polar', name: 'Polar', bg: 'bg-white', text: 'text-[#1a1a1a]', lines: '#000000', canvas: '#ffffff', border: 'border-black' },
  { id: 'midnight', name: 'Midnight', bg: 'bg-[#0f172a]', text: 'text-slate-100', lines: '#e2e8f0', canvas: '#0f172a', border: 'border-slate-300' },
  { id: 'vintage', name: 'Vintage', bg: 'bg-[#fdf6e3]', text: 'text-[#2a363b]', lines: '#2a363b', canvas: '#fdf6e3', border: 'border-[#2a363b]' },
];

const FONTS = [
  { id: 'serif', name: 'Editorial', class: 'font-serif text-[1.6rem] sm:text-[2rem] uppercase tracking-[0.15em] font-light' },
  { id: 'sans', name: 'Modern', class: 'font-sans text-[1.2rem] sm:text-[1.4rem] uppercase tracking-[0.3em] font-medium' },
  { id: 'script', name: 'Classic', class: 'font-[Great_Vibes,cursive] text-[2.8rem] sm:text-[3.8rem] leading-none capitalize font-normal' },
  { id: 'cinzel', name: 'Cinzel', class: 'font-[Cinzel,serif] text-[1.4rem] sm:text-[1.8rem] uppercase tracking-[0.2em] font-medium' },
];

const SpotifyIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.54.659.3 1.021zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.84.24 1.2zM20.4 9.12C16.44 6.72 9.48 6.48 5.52 7.68c-.6.181-1.26-.12-1.44-.72-.18-.601.12-1.26.72-1.44 4.56-1.32 12.12-1.08 16.68 1.62.54.301.72.96.42 1.5-.24.54-.9.72-1.5.48z"/>
  </svg>
);

const ConstellationMap = ({ themeConfig, hasBg = false, seedString = "" }: { themeConfig: any, hasBg?: boolean, seedString?: string }) => {
  const { stars, lines, milkyWayStars, moonPhase } = useMemo(() => {
    const random = mulberry32(stringToSeed(seedString + "starmap"));
    
    const stars = [];
    const milkyWayStars = [];
    // Background stars
    for (let i = 0; i < 2000; i++) {
        stars.push({
            cx: random() * 100,
            cy: random() * 100,
            r: random() < 0.9 ? (random() * 0.15 + 0.05) : (random() * 0.25 + 0.1),
            opacity: random() * 0.8 + 0.2
        });
    }
    
    // Milky way dense stars
    for (let i = 0; i < 1500; i++) {
        let u = random();
        let v = random();
        let t = (u - 0.5) * 140; 
        let spread = (v - 0.5) * 30; 
        let angle = -35 * (Math.PI / 180);
        let cx = 50 + t * Math.cos(angle) - spread * Math.sin(angle);
        let cy = 50 + t * Math.sin(angle) + spread * Math.cos(angle);
        
        if (cx > -10 && cx < 110 && cy > -10 && cy < 110) {
            milkyWayStars.push({
                cx, cy,
                r: random() * 0.15 + 0.05,
                opacity: random() * 0.6 + 0.1
            });
        }
    }

    const lines = [];
    for(let i=0; i < 60; i++) {
       let startX = 10 + random() * 80;
       let startY = 10 + random() * 80;
       
       let pointsLeft = Math.floor(random() * 4) + 2;
       let currentX = startX;
       let currentY = startY;
       
       for(let j=0; j<pointsLeft; j++) {
           let angle = random() * Math.PI * 2;
           let dist = 3 + random() * 10;
           let nextX = currentX + Math.cos(angle) * dist;
           let nextY = currentY + Math.sin(angle) * dist;
           
           lines.push({ x1: currentX, y1: currentY, x2: nextX, y2: nextY });
           stars.push({ cx: currentX, cy: currentY, r: 0.35 + random() * 0.2, opacity: 1 });
           stars.push({ cx: nextX, cy: nextY, r: 0.35 + random() * 0.2, opacity: 1 });
           currentX = nextX;
           currentY = nextY;
       }
    }
    
    // Random moon phase offset (-50 to +50)
    const moonPhase = (random() * 100) - 50;

    return { stars, lines, milkyWayStars, moonPhase };
  }, [seedString]);

  const lineColor = themeConfig.lines;
  const canvasColor = themeConfig.canvas;

  return (
    <div className={`relative w-full aspect-square flex items-center justify-center rounded-full overflow-hidden ${hasBg ? 'bg-black/30 backdrop-blur-xl border-[1.5px] border-white/60' : `border-[1px] ${themeConfig.border}`}`} style={{ transform: 'translateZ(0)', backgroundColor: hasBg ? 'transparent' : canvasColor }}>
      <svg viewBox="0 0 100 100" className="w-full h-full opacity-100" preserveAspectRatio="xMidYMid slice">
        <defs>
          <clipPath id="circle-clip">
            <circle cx="50" cy="50" r="50" />
          </clipPath>
          <filter id="heavy-glow">
            <feGaussianBlur stdDeviation="7" />
          </filter>
        </defs>
        
        <g clipPath="url(#circle-clip)">
          <rect width="100" height="100" fill={hasBg ? "transparent" : canvasColor} />
          
          {/* Milky Way dust clouds */}
          {themeConfig.id !== 'polar' && themeConfig.id !== 'vintage' && (
            <>
              <ellipse cx="50" cy="50" rx="65" ry="15" fill={lineColor} opacity="0.06" transform="rotate(-35 50 50)" filter="url(#heavy-glow)" />
              <ellipse cx="50" cy="50" rx="45" ry="8" fill={lineColor} opacity="0.08" transform="rotate(-35 50 50)" filter="url(#heavy-glow)" />
            </>
          )}
          
          {/* Milky way clustered stars */}
          {milkyWayStars.map((s, i) => (
            <circle key={`mw-${i}`} cx={s.cx} cy={s.cy} r={s.r} fill={lineColor} opacity={s.opacity * 0.8} />
          ))}

          {/* Background Stars */}
          {stars.map((s, i) => (
            <circle key={`star-${i}`} cx={s.cx} cy={s.cy} r={s.r} fill={lineColor} opacity={s.opacity} />
          ))}
          
          {/* Moon Element (only sometimes visible depending on seed) */}
          <g transform={`translate(${85}, ${20}) scale(0.12)`}>
             <circle cx="50" cy="50" r="40" fill={lineColor} opacity="0.9"/>
             <circle cx={50 + moonPhase} cy="45" r="42" fill={canvasColor} />
          </g>

          {/* Constellation Lines */}
          {lines.map((l, i) => (
            <line key={`line-${i}`} x1={l.x1} y1={l.y1} x2={l.x2} stroke={lineColor} y2={l.y2} strokeWidth="0.15" opacity="0.4" />
          ))}
        </g>
        
        {/* Subtle grid rings and compass marks */}
        <circle cx="50" cy="50" r="49.5" fill="none" stroke={lineColor} strokeWidth="0.2" opacity="0.5" />
        <circle cx="50" cy="50" r="48" fill="none" stroke={lineColor} strokeWidth="0.1" opacity="0.3" strokeDasharray="0.5 1" />
        
        <text x="50" y="3.5" fontSize="2.5" fill={lineColor} opacity="0.7" textAnchor="middle" dominantBaseline="middle" fontFamily="sans-serif">N</text>
        <text x="50" y="97.5" fontSize="2.5" fill={lineColor} opacity="0.7" textAnchor="middle" dominantBaseline="middle" fontFamily="sans-serif">S</text>
        <text x="3.5" y="50" fontSize="2.5" fill={lineColor} opacity="0.7" textAnchor="middle" dominantBaseline="middle" fontFamily="sans-serif">W</text>
        <text x="96.5" y="50" fontSize="2.5" fill={lineColor} opacity="0.7" textAnchor="middle" dominantBaseline="middle" fontFamily="sans-serif">E</text>
      </svg>
    </div>
  );
};

const SpotifyCode = ({ seedString = "" }: { seedString?: string }) => {
  const bars = useMemo(() => {
    const random = mulberry32(stringToSeed(seedString + "spotify"));
    return Array.from({length: 45}).map((_, i) => {
      if (i < 3 || i > 41) return random() * 0.3 + 0.1;
      return random() * 0.8 + 0.2;
    });
  }, [seedString]);

  return (
    <div className="flex items-center justify-center gap-4 mt-2">
      <SpotifyIcon className="w-5 h-5 flex-shrink-0" />
      <div className="flex items-center gap-0.5 h-8">
        {bars.map((height, i) => (
          <div 
            key={i} 
            className="w-[2px] bg-current rounded-full" 
            style={{ height: `${height * 100}%` }} 
          />
        ))}
      </div>
    </div>
  );
};

export default function App() {
  const [title, setTitle] = useState("Music in the sky");
  const [date, setDate] = useState("8 DE NOVIEMBRE 1993");
  const [locationName, setLocationName] = useState("NEUQUÉN CAPITAL");
  const [coordinates, setCoordinates] = useState("38.9517 S  68.0592 W");
  const [spotifyUrl, setSpotifyUrl] = useState("https://open.spotify.com/track/...");
  const [posterTheme, setPosterTheme] = useState('obsidian');
  const [titleFont, setTitleFont] = useState('serif');
  const [showSpotify, setShowSpotify] = useState(true);

  // Background Image State
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [bgOffset, setBgOffset] = useState({ x: 0, y: 0 });
  const [bgScale, setBgScale] = useState(1);
  const [bgOverlay, setBgOverlay] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  
  // Auth and Data states
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [savedMaps, setSavedMaps] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedMaps, setShowSavedMaps] = useState(false);
  const [currentMapId, setCurrentMapId] = useState<string | null>(null);

  // App View State
  const [currentView, setCurrentView] = useState<'landing' | 'editor'>('landing');

  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const posterRef = useRef<HTMLDivElement>(null);

  // Derive generated seed using inputs
  const combinedSeedInput = title + date + locationName + coordinates;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        loadSavedMaps(currentUser.uid);
      } else {
        setSavedMaps([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadSavedMaps = async (uid: string) => {
    try {
      const q = query(collection(db, 'maps'), where('ownerId', '==', uid));
      const querySnapshot = await getDocs(q);
      const mapsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSavedMaps(mapsData);
    } catch (err) {
      console.error('Failed to load saved maps', err);
    }
  };

  const handleSaveMap = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const mapData = {
        title,
        date,
        locationName,
        coordinates,
        spotifyUrl,
        posterTheme,
        titleFont,
        showSpotify,
        bgImage,
        bgOffset,
        bgScale,
        bgOverlay,
        ownerId: user.uid,
        updatedAt: serverTimestamp(),
      };

      if (currentMapId) {
        await updateDoc(doc(db, 'maps', currentMapId), mapData);
      } else {
        const docRef = await addDoc(collection(db, 'maps'), {
          ...mapData,
          createdAt: serverTimestamp(),
        });
        setCurrentMapId(docRef.id);
      }
      await loadSavedMaps(user.uid);
      alert('Map saved successfully!');
    } catch (err) {
      console.error('Failed to save map', err);
      alert('Error saving the map. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const loadMap = (mapData: any) => {
    setTitle(mapData.title || "");
    setDate(mapData.date || "");
    setLocationName(mapData.locationName || "");
    setCoordinates(mapData.coordinates || "");
    setSpotifyUrl(mapData.spotifyUrl || "");
    setPosterTheme(mapData.posterTheme || "obsidian");
    setTitleFont(mapData.titleFont || "serif");
    setShowSpotify(mapData.showSpotify ?? true);
    setBgImage(mapData.bgImage || null);
    setBgOffset(mapData.bgOffset || { x: 0, y: 0 });
    setBgScale(mapData.bgScale || 1);
    setBgOverlay(mapData.bgOverlay || 0);
    setCurrentMapId(mapData.id);
    setShowSavedMaps(false);
    setCurrentView('editor');
  };

  const handleNewMap = () => {
    setTitle("Music in the sky");
    setDate("24 DE AGOSTO 2022");
    setLocationName("MADRID, SPAIN");
    setCoordinates("40.4168° N, 3.7038° W");
    setSpotifyUrl("https://open.spotify.com/track/...");
    setPosterTheme("obsidian");
    setTitleFont("serif");
    setShowSpotify(true);
    setBgImage(null);
    setBgOffset({ x: 0, y: 0 });
    setBgScale(1);
    setBgOverlay(0);
    setCurrentMapId(null);
    setCurrentView('editor');
  };

  useEffect(() => {
    // Fetch and inject fonts manually to avoid html-to-image CORS/cssRules errors
    const fetchFonts = async () => {
      try {
        const response = await fetch('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600&family=Great+Vibes&family=Montserrat:wght@300;400;500&display=swap');
        const css = await response.text();
        const style = document.createElement('style');
        style.id = 'injected-google-fonts';
        style.innerHTML = css;
        document.head.appendChild(style);
      } catch (e) {
        console.error('Failed to fetch fonts', e);
      }
    };
    if (!document.getElementById('injected-google-fonts')) {
      fetchFonts();
    }
  }, []);

  const handleExport = async () => {
    if (!posterRef.current) return;
    
    setIsExporting(true);
    try {
      // Scale up factor for higher resolution export (e.g., 3x for high quality print)
      const scale = 3; 
      const node = posterRef.current;

      const dataUrl = await toPng(node, {
        quality: 1,
        pixelRatio: scale,
        style: {
          transform: 'scale(1)',
          transition: 'none',
        },
      });

      const link = document.createElement('a');
      link.download = `star-map-${title.replace(/\s+/g, '-').toLowerCase() || 'poster'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export poster', err);
      alert('Error exporting the poster. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          const maxDim = 1200;
          if (width > height && width > maxDim) {
            height *= maxDim / width;
            width = maxDim;
          } else if (height > maxDim) {
            width *= maxDim / height;
            height = maxDim;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setBgImage(dataUrl);
            setBgOffset({ x: 0, y: 0 });
            setBgScale(1);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!bgImage) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX - bgOffset.x, y: e.clientY - bgOffset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    setBgOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const activeThemeConfig = THEMES.find(t => t.id === posterTheme) || THEMES[0];
  const activeFontConfig = FONTS.find(f => f.id === titleFont) || FONTS[0];

  if (currentView === 'landing') {
    return (
      <div className="flex min-h-screen w-full bg-[#050505] font-sans text-white items-center justify-center p-6 lg:p-12 relative overflow-hidden">
        {/* Animated cosmic background for landing */}
        <div className="absolute inset-0 z-0 flex items-center justify-center opacity-20 pointer-events-none select-none">
           <div className="w-[150vw] h-[150vw] sm:w-[120vw] sm:h-[120vw] animate-[spin_240s_linear_infinite]">
             <ConstellationMap themeConfig={THEMES[0]} hasBg={false} seedString="landing-page-hero" />
           </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-[#050505] z-0 pointer-events-none"></div>

        {user && (
          <button 
             onClick={logout} 
             className="absolute top-6 right-6 text-[10px] text-gray-500 hover:text-white uppercase tracking-widest font-bold transition-colors z-20 flex items-center gap-2"
          >
             <LogOut className="w-3 h-3" /> Logout
          </button>
        )}

        <div className="max-w-4xl w-full bg-[#0a0a0a]/60 backdrop-blur-3xl border border-white/10 rounded-2xl p-8 lg:p-12 shadow-2xl relative z-10 flex flex-col items-center">
          <div className="w-12 h-12 mb-6 rounded-full border border-white/20 flex items-center justify-center backdrop-blur-xl">
             <Compass className="w-6 h-6 text-white/80" />
          </div>
          <div className="flex flex-col items-center text-center gap-4">
            <h1 className="text-3xl sm:text-5xl font-serif tracking-[0.2em] font-light uppercase">Starlight Posters</h1>
            <p className="text-sm text-gray-400 tracking-[0.2em] uppercase max-w-lg">
              Design a beautiful, personalized constellation poster based on a specific date and location.
            </p>

            <div className={`mt-8 w-full ${user && savedMaps.length > 0 ? 'max-w-4xl' : 'max-w-md'} space-y-6`}>
              {user ? (
                <div className="flex flex-col gap-6">
                  <button 
                    onClick={handleNewMap}
                    className="w-full max-w-md mx-auto bg-white text-black py-4 rounded text-xs font-bold uppercase tracking-[0.2em] hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Create New Map
                  </button>

                  <div className="space-y-4 text-left pt-6 mt-4">
                    <div className="flex items-center justify-between mb-2">
                       <h2 className="text-[11px] text-gray-500 uppercase tracking-[0.2em] font-bold flex items-center gap-2">
                         <FolderOpen className="w-4 h-4" /> Your Saved Designs
                       </h2>
                       <span className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">
                          {savedMaps.length} map{savedMaps.length === 1 ? '' : 's'}
                       </span>
                    </div>
                    
                    {savedMaps.length === 0 ? (
                      <div className="bg-[#1a1a1a] border border-[#333] p-8 rounded text-center max-w-md mx-auto">
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">You haven't saved any maps yet.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                        {savedMaps.map(mapData => {
                           const miniTheme = THEMES.find(t => t.id === mapData.posterTheme) || THEMES[0];
                           const miniFont = FONTS.find(f => f.id === mapData.titleFont) || FONTS[0];
                           const combinedSeed = (mapData.title || "") + (mapData.date || "") + (mapData.locationName || "") + (mapData.coordinates || "");
                           return (
                          <div key={mapData.id} className="bg-[#121212] border border-[#222] rounded-xl hover:border-gray-500 transition-all flex flex-col group cursor-pointer overflow-hidden transform hover:-translate-y-1 shadow-lg" onClick={() => loadMap(mapData)}>
                            {/* Mini preview */}
                            <div className={`w-full aspect-[3/4] relative ${miniTheme.bg} flex flex-col items-center justify-between p-4 pointer-events-none`}>
                               {/* Inner Border */}
                               <div className={`absolute inset-[6%] border-[1px] z-10 ${miniTheme.border} opacity-50`} />
                               
                               {mapData.bgImage && (
                                   <div 
                                      className="absolute inset-0 z-0 opacity-40 mix-blend-screen scale-110"
                                      style={{
                                        backgroundImage: `url(${mapData.bgImage})`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center'
                                      }}
                                    />
                               )}
                               
                               <div className="flex-1 flex flex-col items-center z-10 w-full justify-between pointer-events-none relative">
                                  {/* Map Circle */}
                                  <div className="w-full max-w-[80%] mt-[15%] drop-shadow-xl z-10">
                                      <ConstellationMap themeConfig={miniTheme} hasBg={!!mapData.bgImage} seedString={combinedSeed} />
                                  </div>
                                  {/* Text area */}
                                  <div className={`flex flex-col items-center mt-auto text-center gap-1 w-full ${miniTheme.text} z-10 pb-2`}>
                                      <h2 className={`${miniFont.class} !text-[12px] truncate w-full break-words px-2`}>{mapData.title || ' '}</h2>
                                      <div className={`w-4 h-[1px] bg-current opacity-30 mt-1`}></div>
                                      <p className="text-[6px] uppercase tracking-[0.2em] mt-1 opacity-70 truncate w-full px-2 font-medium">{mapData.date}</p>
                                  </div>
                               </div>
                            </div>
                            <div className="p-4 bg-[#1a1a1a] border-t border-[#333]">
                               <h3 className="text-white text-[11px] font-bold uppercase tracking-[0.2em] truncate group-hover:text-blue-400 transition-colors">{mapData.title || 'Untitled Map'}</h3>
                               <p className="text-[9px] text-gray-500 tracking-wider mt-1.5 uppercase font-medium truncate flex items-center gap-1.5"><MapPin className="w-3 h-3" />{mapData.locationName}</p>
                            </div>
                          </div>
                        )})}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <button 
                    onClick={handleNewMap}
                    className="w-full bg-transparent border border-white text-white py-4 rounded text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-white hover:text-black transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Start Designing (No Sign In)
                  </button>
                  <div className="relative py-4">
                     <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#333]"></div></div>
                     <div className="relative flex justify-center"><span className="bg-[#121212] px-4 text-[10px] text-gray-500 uppercase tracking-widest">or</span></div>
                  </div>
                  <button 
                    onClick={signInWithGoogle}
                    className="w-full bg-white text-black py-4 rounded text-xs font-bold uppercase tracking-widest hover:bg-gray-200 transition-colors flex items-center justify-center gap-3"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Sign in with Google
                  </button>
                  <p className="text-[10px] text-gray-500 tracking-wider font-bold uppercase mt-2">Sign in to save your designs to the cloud and access them anytime.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-[#0a0a0a] font-sans text-gray-300 flex-col lg:flex-row overflow-hidden">
      {/* Sidebar Editor */}
      <aside className="w-full lg:w-[400px] border-b lg:border-b-0 lg:border-r border-[#222] bg-[#121212] p-6 lg:p-8 flex flex-col gap-6 shrink-0 overflow-y-auto max-h-screen z-10 shadow-2xl relative">
        <div className="mb-4 flex flex-col gap-6">
          <button 
            onClick={() => setCurrentView('landing')}
            className="flex items-center gap-2 text-[10px] text-gray-500 hover:text-white uppercase tracking-widest font-bold transition-colors w-fit"
          >
            <ArrowLeft className="w-3 h-3" /> Dashboard
          </button>
          <div>
            <h1 className="text-white text-xl font-light tracking-widest uppercase">Star Map Creator</h1>
            <p className="text-[10px] text-gray-500 tracking-[0.2em] mt-1 uppercase">Customize your personal constellation poster.</p>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold flex items-center gap-2">
              Theme / Colors
            </label>
            <div className="grid grid-cols-2 gap-2">
              {THEMES.map(theme => (
                <button 
                  key={theme.id}
                  onClick={() => setPosterTheme(theme.id)}
                  className={`py-2 px-3 text-[10px] font-bold uppercase tracking-widest rounded border flex items-center gap-2 transition-all ${posterTheme === theme.id ? 'bg-white text-black border-white' : 'bg-[#1a1a1a] text-gray-400 border-[#333] hover:border-gray-500'}`}
                >
                  <div className={`w-3 h-3 rounded-full ${theme.bg} border border-[#555]`}></div>
                  {theme.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold flex items-center gap-2">
              Typography List
            </label>
            <div className="grid grid-cols-2 gap-2">
              {FONTS.map(font => (
                <button 
                  key={font.id}
                  onClick={() => setTitleFont(font.id)}
                  className={`py-2 px-3 text-[10px] font-bold tracking-widest rounded border transition-all ${titleFont === font.id ? 'bg-white text-black border-white' : 'bg-[#1a1a1a] text-gray-400 border-[#333] hover:border-gray-500'}`}
                >
                  <p className={`${font.class.split(' ')[0]} ${font.class.split(' ')[1]} ${font.class.split(' ')[2]} leading-none truncate`}>{font.name}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 pt-4 border-t border-[#222]">
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold flex items-center gap-2">
              <Type className="w-4 h-4" /> Title
            </label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-white/40 transition-colors"
              placeholder="e.g. Music in the sky"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Date
            </label>
            <input 
              type="text" 
              value={date}
              onChange={(e) => setDate(e.target.value.toUpperCase())}
              className="w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-white/40 transition-colors"
              placeholder="e.g. 8 DE NOVIEMBRE 1993"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Location Name
            </label>
            <input 
              type="text" 
              value={locationName}
              onChange={(e) => setLocationName(e.target.value.toUpperCase())}
              className="w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-white/40 transition-colors"
              placeholder="e.g. NEUQUÉN CAPITAL"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Coordinates
            </label>
            <input 
              type="text" 
              value={coordinates}
              onChange={(e) => setCoordinates(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-white/40 transition-colors"
              placeholder="e.g. 38.9517 S  68.0592 W"
            />
          </div>

          <div className="space-y-1.5 pt-4 border-t border-[#222]">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold flex items-center gap-2">
                <Music className="w-4 h-4" /> Spotify Link
              </label>
              <button 
                onClick={() => setShowSpotify(!showSpotify)}
                className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded border ${showSpotify ? 'bg-white text-black border-white' : 'bg-transparent text-gray-500 border-gray-700'}`}
              >
                {showSpotify ? 'ON' : 'OFF'}
              </button>
            </div>
            
            {showSpotify && (
              <>
                <input 
                  type="text" 
                  value={spotifyUrl}
                  onChange={(e) => setSpotifyUrl(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-white/40 transition-colors mt-2"
                  placeholder="Paste Spotify URL..."
                />
                <p className="text-xs text-gray-500 mt-1">Changes the dynamic audio barcode automatically.</p>
              </>
            )}
          </div>

          <div className="space-y-1.5 pt-4 border-t border-[#222]">
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> Background Photo
            </label>
            <input 
              type="file" 
              accept="image/*"
              onChange={handleImageUpload}
              className="w-full text-xs text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-[10px] file:font-bold file:uppercase file:tracking-wider file:bg-white file:text-black hover:file:bg-gray-200 transition-colors"
            />
            {bgImage && (
              <div className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                    <span>Scale</span>
                    <span>{bgScale.toFixed(2)}x</span>
                  </div>
                  <input 
                    type="range" min="0.1" max="3" step="0.01" value={bgScale} 
                    onChange={e => setBgScale(parseFloat(e.target.value))} 
                    className="w-full accent-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                    <span>Dark Overlay</span>
                    <span>{bgOverlay}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="100" step="1" value={bgOverlay} 
                    onChange={e => setBgOverlay(parseInt(e.target.value))} 
                    className="w-full accent-white"
                  />
                </div>
                <p className="text-[9px] text-gray-500 uppercase tracking-wide">Tip: Drag the photo in the preview area to reposition it.</p>
                <div className="pt-2">
                   <button onClick={() => setBgImage(null)} className="text-[10px] text-red-500 hover:text-red-400 uppercase tracking-wider font-bold">
                     Remove Photo
                   </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-auto pt-6 flex flex-col gap-3">
           <button 
             className="w-full bg-white text-black py-3 rounded text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
             onClick={handleExport}
             disabled={isExporting}
           >
             {isExporting ? (
               <><Loader2 className="w-4 h-4 animate-spin" /> Generating High-Res PNG...</>
             ) : (
               <><Download className="w-4 h-4" /> Export Poster</>
             )}
           </button>
           
           {user && (
             <div className="flex gap-2 mt-2">
               <button 
                 className="w-full bg-transparent border border-[#333] text-gray-400 py-3 rounded text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-white hover:border-white hover:text-black transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                 onClick={handleSaveMap}
                 disabled={isSaving}
               >
                 {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save Design
               </button>
             </div>
           )}
        </div>
      </aside>

      {/* Preview Area */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8 lg:p-12 overflow-y-auto bg-[#181818]">
        
        {/* Poster Canvas */}
        <div 
          id="poster-frame"
          ref={posterRef}
          className={`w-full max-w-[480px] aspect-[3/4] flex flex-col items-center justify-between p-12 shadow-[0_40px_100px_-15px_rgba(0,0,0,0.8)] border-[1px] relative transition-all duration-700 ease-out hover:scale-[1.015] hover:-translate-y-1 ${activeThemeConfig.bg} ${activeThemeConfig.border} overflow-hidden`}
        >
          {/* Background Image wrapper */}
          <div 
            className={`absolute inset-0 z-0 ${bgImage ? 'cursor-move' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {bgImage && (
              <>
                <img 
                  src={bgImage} 
                  draggable={false}
                  alt="Background"
                  className="w-full h-full object-cover origin-center"
                  style={{
                    transform: `translate(${bgOffset.x}px, ${bgOffset.y}px) scale(${bgScale})`,
                  }}
                />
                <div className="absolute inset-0 bg-black pointer-events-none" style={{ opacity: bgOverlay / 100 }} />
              </>
            )}
          </div>

          {/* Inner Border */}
          <div 
            className={`absolute inset-[4%] border-[1.5px] z-10 pointer-events-none ${activeThemeConfig.border} opacity-50`} 
            style={{ mixBlendMode: bgImage ? 'difference' : 'normal' }}
          />

          <div className="flex-1 flex flex-col items-center z-10 w-full justify-between pointer-events-none relative">
            
            {/* The Constellation Circle */}
            <div className="w-full max-w-[400px] mt-[10%] drop-shadow-2xl">
              <ConstellationMap themeConfig={activeThemeConfig} hasBg={!!bgImage} seedString={combinedSeedInput} />
            </div>

            {/* Poster Texts */}
            <div className={`flex flex-col items-center mt-auto text-center gap-4 w-full ${activeThemeConfig.text}`}>
              <h2 className={`${activeFontConfig.class} break-words`}>
                {title || ' '}
              </h2>
              <div className={`w-12 h-[1px] bg-current opacity-30`}></div>
              
              <div className="flex flex-col gap-1">
                <p className="text-[11px] uppercase tracking-[0.25em] font-medium">
                  {locationName}
                </p>
                <p className={`text-[9px] font-mono tracking-widest uppercase opacity-70`}>
                  {coordinates}
                </p>
                <p className={`text-[10px] tracking-[0.1em] mt-1 uppercase opacity-70`}>
                  {date}
                </p>
              </div>

              {/* Dynamic generated Spotify Code */}
              {showSpotify && (
                 <div className={`mt-2 opacity-90`}> 
                   <SpotifyCode seedString={combinedSeedInput + spotifyUrl} />
                 </div>
              )}
            </div>

          </div>
        </div>
        
      </main>
    </div>
  );
}
