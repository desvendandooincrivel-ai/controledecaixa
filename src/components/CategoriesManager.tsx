import React, { useState } from "react";
import { Plus, Trash2, Edit3, Check, X, Tag, CornerDownRight } from "lucide-react";

// Same interface as defined in App.tsx
export interface Category {
  id: string;
  name: string;
  type: "entrada" | "saida";
  color: string;
}

interface CategoriesManagerProps {
  categories: Category[];
  onCreate: (name: string, type: "entrada" | "saida", color: string) => any;
  onUpdate: (id: string, newName: string, newColor: string) => void;
  onDelete: (id: string) => void;
}

// Available standard colors for user selection
const COLOR_OPTIONS = [
  { class: "bg-emerald-500", label: "Esmeralda", hex: "#10b981" },
  { class: "bg-cyan-500", label: "Ciano", hex: "#06b6d4" },
  { class: "bg-indigo-500", label: "Índigo", hex: "#6366f1" },
  { class: "bg-sky-500", label: "Azul Céu", hex: "#0ea5e9" },
  { class: "bg-teal-500", label: "Teal", hex: "#14b8a6" },
  { class: "bg-amber-500", label: "Âmbar", hex: "#f59e0b" },
  { class: "bg-red-500", label: "Vermelho", hex: "#ef4444" },
  { class: "bg-orange-500", label: "Laranja", hex: "#f97316" },
  { class: "bg-purple-600", label: "Roxo", hex: "#a855f7" },
  { class: "bg-pink-500", label: "Rosa", hex: "#ec4899" },
  { class: "bg-rose-500", label: "Rose", hex: "#f43f5e" },
  { class: "bg-violet-500", label: "Violeta", hex: "#8b5cf6" },
  { class: "bg-zinc-500", label: "Cinza", hex: "#71717a" },
];

export const classToHex = (colorClass: string): string => {
  if (colorClass.startsWith("#")) return colorClass;
  const mapping: Record<string, string> = {
    "bg-emerald-500": "#10b981",
    "bg-cyan-555": "#06b6d4",
    "bg-cyan-500": "#06b6d4",
    "bg-indigo-500": "#6366f1",
    "bg-sky-500": "#0ea5e9",
    "bg-teal-500": "#14b8a6",
    "bg-amber-500": "#f59e0b",
    "bg-red-500": "#ef4444",
    "bg-orange-500": "#f97316",
    "bg-purple-600": "#a855f7",
    "bg-pink-500": "#ec4899",
    "bg-rose-500": "#f43f5e",
    "bg-violet-500": "#8b5cf6",
    "bg-zinc-500": "#71717a"
  };
  return mapping[colorClass] || colorClass || "#10b981";
};

export function CategoriesManager({
  categories,
  onCreate,
  onUpdate,
  onDelete,
}: CategoriesManagerProps) {
  // Creator form state
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"entrada" | "saida">("entrada");
  const [newColor, setNewColor] = useState("bg-emerald-500");

  // Editorial Inline states for existing categories
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameField, setEditNameField] = useState("");
  const [editColorField, setEditColorField] = useState("");

  // Handler to change select type and set corresponding default color
  const handleTypeChange = (type: "entrada" | "saida") => {
    setNewType(type);
    setNewColor(type === "entrada" ? "bg-emerald-500" : "bg-rose-500");
  };

  const handleStartEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditNameField(cat.name);
    setEditColorField(cat.color);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditNameField("");
    setEditColorField("");
  };

  const handleSaveEdit = (id: string) => {
    if (!editNameField.trim()) {
      alert("O nome da categoria não pode estar vazio.");
      return;
    }
    onUpdate(id, editNameField.trim(), editColorField);
    setEditingId(null);
  };

  const handleAddNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      alert("Por favor, digite o nome da categoria.");
      return;
    }
    const created = onCreate(newName, newType, newColor);
    if (created) {
      setNewName("");
      // Reset default select color representation when switching types
      setNewColor(newType === "entrada" ? "bg-emerald-500" : "bg-rose-500");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-slate-800">
      
      {/* Container 1: Creator Panel */}
      <div className="lg:col-span-4 bg-slate-50 border border-slate-100 p-6 rounded-2xl">
        <div className="flex items-center gap-2 mb-4">
          <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
            <Tag size={18} />
          </span>
          <div>
            <h3 className="font-bold text-sm text-slate-800">Nova Categoria</h3>
            <p className="text-[10px] text-slate-450">Estenda o sistema de categorização</p>
          </div>
        </div>

        <form onSubmit={handleAddNew} className="space-y-4 text-xs font-medium">
          
          {/* Form Option Type Selector */}
          <div>
            <label className="text-slate-500 font-bold uppercase tracking-wider text-[10px] block mb-2">
              Tipo de Categoria
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-200/50 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => handleTypeChange("entrada")}
                className={`py-2 text-center font-bold rounded-lg cursor-pointer transition select-none ${
                  newType === "entrada"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                🟢 Entrada
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange("saida")}
                className={`py-2 text-center font-bold rounded-lg cursor-pointer transition select-none ${
                  newType === "saida"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                🔴 Saída
              </button>
            </div>
          </div>

          {/* Form Option Title Input */}
          <div className="flex flex-col">
            <label className="text-slate-505 font-bold uppercase tracking-wider text-[10px] mb-1.5">
              Nome da Categoria
            </label>
            <input
              type="text"
              placeholder="Ex: Combustível, Assessoria, Pix..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="bg-white border border-slate-200 focus:border-indigo-400 rounded-xl p-2.5 outline-none font-semibold text-xs transition"
            />
          </div>
          {/* Form Option Color Picker (Canvas style) */}
          <div>
            <label className="text-slate-500 font-bold uppercase tracking-wider text-[10px] block mb-1.5">
              Cor Identificadora
            </label>
            <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200">
              <div 
                className="relative w-12 h-12 rounded-xl border border-slate-250 shadow-3xs overflow-hidden cursor-pointer flex items-center justify-center transition hover:scale-105 active:scale-95 group" 
                style={{ backgroundColor: classToHex(newColor) }}
              >
                <input
                  type="color"
                  value={classToHex(newColor)}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                />
                <span className="text-white text-xs select-none drop-shadow-md filter brightness-95 font-bold group-hover:scale-110 transition">🎨</span>
              </div>
              <div className="flex-1 space-y-1">
                <span className="text-[10px] text-slate-450 font-bold uppercase block">Escolha a tonalidade</span>
                <input
                  type="text"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="bg-slate-50 border border-slate-205 focus:border-indigo-400 rounded-lg py-1 px-2 outline-none font-mono text-[11px] font-bold text-slate-700 w-28 uppercase text-center"
                  placeholder="#10B981"
                  maxLength={30}
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-sm hover:shadow transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus size={14} />
            <span>Adicionar Categoria</span>
          </button>

        </form>
      </div>

      {/* Container 2: Columns Lists */}
      <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* ENTRADAS BOARD COLUMN */}
        <div className="border border-slate-100 rounded-2xl p-5">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 select-none">
            <span className="text-xs font-bold uppercase text-emerald-600 tracking-wider flex items-center gap-1.5">
              🟢 Categorias de Entrada
            </span>
            <span className="bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded text-[10px] font-mono">
              {categories.filter((c) => c.type === "entrada").length} itens
            </span>
          </div>

          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {categories
              .filter((c) => c.type === "entrada")
              .map((cat) => {
                const isEditing = editingId === cat.id;

                return (
                  <div
                    key={cat.id}
                    className="flex flex-col p-2.5 rounded-xl border border-slate-100 bg-white hover:border-slate-205 transition"
                  >
                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editNameField}
                            onChange={(e) => setEditNameField(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-semibold text-slate-700 flex-1 outline-none"
                            maxLength={30}
                          />
                          <button
                            onClick={() => handleSaveEdit(cat.id)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                            title="Salvar alterações"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                            title="Cancelar"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                          <div 
                            className="relative w-8 h-8 rounded-lg border border-slate-200 shadow-3xs overflow-hidden cursor-pointer flex items-center justify-center transition hover:scale-105 active:scale-95" 
                            style={{ backgroundColor: classToHex(editColorField) }}
                          >
                            <input
                              type="color"
                              value={classToHex(editColorField)}
                              onChange={(e) => setEditColorField(e.target.value)}
                              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                            />
                            <span className="text-[10px] select-none">🎨</span>
                          </div>
                          <div className="flex-1">
                            <span className="text-[9px] text-slate-400 font-bold uppercase block mb-0.5">Cor</span>
                            <input
                              type="text"
                              value={editColorField}
                              onChange={(e) => setEditColorField(e.target.value)}
                              className="bg-white border border-slate-200 focus:border-indigo-400 rounded px-1.5 py-0.5 outline-none font-mono text-[9px] font-bold text-slate-700 w-24 uppercase text-center"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2.5">
                          <span 
                            className={`h-2.5 w-2.5 rounded-full shadow-3xs flex-shrink-0 ${!cat.color.startsWith("#") ? cat.color : ""}`}
                            style={cat.color.startsWith("#") ? { backgroundColor: cat.color } : undefined}
                          ></span>
                          <span className="text-xs font-bold text-slate-700">{cat.name}</span>
                        </span>
                        
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStartEdit(cat)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/50 rounded-lg cursor-pointer transition"
                            title="Editar"
                          >
                            <Edit3 size={12} />
                          </button>
                          <button
                            onClick={() => onDelete(cat.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-550 hover:bg-rose-50/50 rounded-lg cursor-pointer transition"
                            title="Descartar"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>

        {/* SAIDAS BOARD COLUMN */}
        <div className="border border-slate-100 rounded-2xl p-5">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 select-none">
            <span className="text-xs font-bold uppercase text-rose-500 tracking-wider flex items-center gap-1.5">
              🔴 Categorias de Saída
            </span>
            <span className="bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded text-[10px] font-mono">
              {categories.filter((c) => c.type === "saida").length} itens
            </span>
          </div>

          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {categories
              .filter((c) => c.type === "saida")
              .map((cat) => {
                const isEditing = editingId === cat.id;

                return (
                  <div
                    key={cat.id}
                    className="flex flex-col p-2.5 rounded-xl border border-slate-100 bg-white hover:border-slate-205 transition"
                  >
                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editNameField}
                            onChange={(e) => setEditNameField(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-semibold text-slate-700 flex-1 outline-none"
                            maxLength={30}
                          />
                          <button
                            onClick={() => handleSaveEdit(cat.id)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                            title="Salvar alterações"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                            title="Cancelar"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                          <div 
                            className="relative w-8 h-8 rounded-lg border border-slate-200 shadow-3xs overflow-hidden cursor-pointer flex items-center justify-center transition hover:scale-105 active:scale-95" 
                            style={{ backgroundColor: classToHex(editColorField) }}
                          >
                            <input
                              type="color"
                              value={classToHex(editColorField)}
                              onChange={(e) => setEditColorField(e.target.value)}
                              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                            />
                            <span className="text-[10px] select-none">🎨</span>
                          </div>
                          <div className="flex-1">
                            <span className="text-[9px] text-slate-400 font-bold uppercase block mb-0.5">Cor</span>
                            <input
                              type="text"
                              value={editColorField}
                              onChange={(e) => setEditColorField(e.target.value)}
                              className="bg-white border border-slate-200 focus:border-indigo-400 rounded px-1.5 py-0.5 outline-none font-mono text-[9px] font-bold text-slate-700 w-24 uppercase text-center"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2.5 font-semibold text-slate-700">
                          <span 
                            className={`h-2.5 w-2.5 rounded-full shadow-3xs flex-shrink-0 ${!cat.color.startsWith("#") ? cat.color : ""}`}
                            style={cat.color.startsWith("#") ? { backgroundColor: cat.color } : undefined}
                          ></span>
                          <span className="text-xs font-bold text-slate-700">{cat.name}</span>
                        </span>
                        
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStartEdit(cat)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/50 rounded-lg cursor-pointer transition"
                            title="Editar"
                          >
                            <Edit3 size={12} />
                          </button>
                          <button
                            onClick={() => onDelete(cat.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-550 hover:bg-rose-50/50 rounded-lg cursor-pointer transition"
                            title="Descartar"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>

      </div>

    </div>
  );
}
