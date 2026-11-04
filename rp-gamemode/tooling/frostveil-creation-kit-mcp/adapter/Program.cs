using System.Text.Json;
using System.Diagnostics;
using Noggog;
using Mutagen.Bethesda;
using Mutagen.Bethesda.Plugins;
using Mutagen.Bethesda.Plugins.Binary.Parameters;
using Mutagen.Bethesda.Skyrim;

// Private subprocess adapter, never an arbitrary script engine. The MCP parent
// supplies only confined snapshots/output paths. One bounded request per process.
try {
 var input=Console.In.ReadLine();
 if(input==null||input.Length>32768)throw new Exception("Request bound");
 using var doc=JsonDocument.Parse(input);var r=doc.RootElement;
 var op=r.GetProperty("op").GetString();
 object result=op switch {
  "inspect"=>Inspect(r.GetProperty("path").GetString()!),
  "resolve"=>Resolve(r.GetProperty("master").GetString()!),
  "installation"=>new {creationKit=FileVersionInfo.GetVersionInfo(Path.Combine(r.GetProperty("game").GetString()!,"CreationKit.exe")).FileVersion,skyrim=FileVersionInfo.GetVersionInfo(Path.Combine(r.GetProperty("game").GetString()!,"SkyrimSE.exe")).FileVersion,mutagen=typeof(SkyrimMod).Assembly.GetName().Version!.ToString(),nativeBridgeInstalled=false},
  "create"=>Create(r),
  _=>throw new Exception("Unsupported adapter operation")
 };
 Console.WriteLine(JsonSerializer.Serialize(result));
}catch(Exception e){Console.Error.WriteLine(e);Environment.ExitCode=2;}

static object Inspect(string file){
 using var mod=SkyrimMod.CreateFromBinaryOverlay(file,SkyrimRelease.SkyrimSE);
 return new {plugin=mod.ModKey.ToString(),masters=mod.ModHeader.MasterReferences.Select(m=>m.Master.ToString()).ToArray(),
 npcs=mod.Npcs.Select(n=>new {localId=n.FormKey.ID,formKey=n.FormKey.ToString(),editorId=n.EditorID,name=n.Name?.String,deleted=n.IsDeleted,race=n.Race.FormKey.ToString(),sex=n.Configuration.Flags.HasFlag(NpcConfiguration.Flag.Female)?"female":"male",unique=n.Configuration.Flags.HasFlag(NpcConfiguration.Flag.Unique),height=n.Height,headParts=n.HeadParts.Select(h=>h.FormKey.ToString()).ToArray(),outfit=n.DefaultOutfit.FormKey.ToString(),inventory=n.Items?.Select(i=>new {form=i.Item.Item.FormKey.ToString(),count=i.Item.Count}).ToArray()}).ToArray(),
 outfits=mod.Outfits.Select(o=>new {localId=o.FormKey.ID,editorId=o.EditorID,items=o.Items?.Select(i=>i.FormKey.ToString()).ToArray()??[]}).ToArray()};
}
static object Resolve(string master){
 using var m=SkyrimMod.CreateFromBinaryOverlay(master,SkyrimRelease.SkyrimSE);
 var race=m.Races.Single(r=>r.EditorID=="NordRace");
 // Exact vanilla references are resolved by EDID and their types, never guessed.
 var ids=new[]{"HairFemaleNord12","FemaleBrowsHuman08","FemaleEyesHumanLightBlue","MarksFemaleHumanoid00NoGash"};
 var heads=ids.Select(id=>m.HeadParts.Single(h=>h.EditorID==id)).ToArray();
 var armorIds=new[]{"ClothesWarlockRobes","ClothesWarlockBoots"};
 var armors=armorIds.Select(id=>m.Armors.Single(x=>x.EditorID==id)).ToArray();
 return new {race=new {editorId=race.EditorID,formKey=race.FormKey.ToString()},headParts=heads.Select(h=>new {editorId=h.EditorID,formKey=h.FormKey.ToString(),type=h.Type.ToString(),flags=h.Flags.ToString()}).ToArray(),armor=armors.Select(x=>new {editorId=x.EditorID,formKey=x.FormKey.ToString(),slots=(uint)(x.BodyTemplate?.FirstPersonFlags??0)}).ToArray()};
}
static object Create(JsonElement r){
 var file=r.GetProperty("output").GetString()!;
 if(File.Exists(file)||!Path.GetFileName(file).StartsWith("FrostveilMCP_",StringComparison.Ordinal)||Path.GetExtension(file)!=".esp")throw new Exception("Fresh owned full ESP required");
 var mod=new SkyrimMod(ModKey.FromFileName(Path.GetFileName(file)),SkyrimRelease.SkyrimSE);
 var spec=r.GetProperty("spec");var refs=r.GetProperty("refs");
 var outfit=new Outfit(new FormKey(mod.ModKey,0x801),SkyrimRelease.SkyrimSE){EditorID=spec.GetProperty("editorId").GetString()+"_Outfit",Items=new()};
 foreach(var armor in refs.GetProperty("armor").EnumerateArray())outfit.Items.Add(FormKey.Factory(armor.GetProperty("formKey").GetString()!));
 mod.Outfits.Add(outfit);
 var n=new Npc(new FormKey(mod.ModKey,0x800),SkyrimRelease.SkyrimSE){EditorID=spec.GetProperty("editorId").GetString(),Name=spec.GetProperty("displayName").GetString(),Height=spec.GetProperty("height").GetSingle(),Weight=50};
 n.Configuration.Flags=NpcConfiguration.Flag.Female|NpcConfiguration.Flag.Unique;
 n.Race.SetTo(FormKey.Factory(refs.GetProperty("race").GetProperty("formKey").GetString()!));
 foreach(var head in refs.GetProperty("headParts").EnumerateArray())n.HeadParts.Add(FormKey.Factory(head.GetProperty("formKey").GetString()!));
 n.DefaultOutfit.SetTo(outfit.FormKey);
 // Start fresh; never DeepCopy an NPC with inherited scripts or gameplay state.
 mod.Npcs.Add(n);
 mod.WriteToBinary(file,new BinaryWriteParameters());
 return Inspect(file);
}
