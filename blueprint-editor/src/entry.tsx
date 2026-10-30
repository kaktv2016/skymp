import React from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';
const App=React.lazy(()=>import('./main').then(m=>({default:m.App})));
const Npcs=React.lazy(()=>import('./npc-management').then(m=>({default:m.NpcManagementApp})));

const root=document.getElementById('root');
if(root)createRoot(root).render(<React.StrictMode><React.Suspense fallback={<p>Loading Frostveil Studio…</p>}>{location.pathname==='/npcs'?<Npcs/>:<App/>}</React.Suspense></React.StrictMode>);
