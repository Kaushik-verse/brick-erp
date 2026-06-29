import { useState, useEffect } from 'react';
import { ArrowLeft, Save, Factory } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import ScreenHeader from '../../core/ui/ScreenHeader';
import GlassCard from '../../core/ui/GlassCard';
import GlassButton from '../../core/ui/GlassButton';
import { GlassInput } from '../../core/ui/GlassFormControls';
import { db } from '../../core/db/schema';
import { useUIStore } from '../../core/store/uiStore';

export default function RecipeSettingsScreen({ onBack }) {
  const pushToast = useUIStore((s) => s.pushToast);
  
  const recipes = useLiveQuery(() => db.recipes.toArray(), [], []);
  const materials = useLiveQuery(() => db.rawMaterials.filter(m => m.isActive !== 0).toArray(), [], []);
  const products = useLiveQuery(() => db.finishedStock.filter(p => p.isActive !== 0).toArray(), [], []);

  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (!recipes || !products || !materials) return;
    
    const initial = {};
    for (const p of products) {
      initial[p.brickSize] = {};
      const existing = recipes.find(r => r.brickSize === p.brickSize);
      
      for (const m of materials) {
        if (existing?.materials && existing.materials[m.id] !== undefined) {
           initial[p.brickSize][m.id] = String(existing.materials[m.id]);
        } else if (existing) {
           // Fallback to legacy field names
           let val = '';
           if (m.name.toLowerCase().includes('fly')) val = existing.flyAshKg;
           else if (m.name.toLowerCase().includes('lime')) val = existing.limeKg;
           else if (m.name.toLowerCase().includes('gypsum')) val = existing.gypsumKg;
           else if (m.name.toLowerCase().includes('quarry') || m.name.toLowerCase().includes('sand')) val = existing.sandKg;
           
           initial[p.brickSize][m.id] = val !== undefined ? String(val) : '0';
        } else {
           initial[p.brickSize][m.id] = '0';
        }
      }
    }
    setFormData(initial);
  }, [recipes, products, materials]);

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const [brickSize, mats] of Object.entries(formData)) {
        const recipeObj = {
          brickSize,
          materials: {},
        };
        for (const [matId, qty] of Object.entries(mats)) {
          recipeObj.materials[matId] = Number(qty) || 0;
        }

        const existing = await db.recipes.where('brickSize').equals(brickSize).first();
        if (existing) {
          await db.recipes.update(existing.id, recipeObj);
        } else {
          await db.recipes.add(recipeObj);
        }
      }
      pushToast('Recipes updated successfully', 'success');
      onBack();
    } catch (e) {
      pushToast('Error saving recipes', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = (brickSize, matId, val) => {
    setFormData(prev => ({
      ...prev,
      [brickSize]: {
        ...(prev[brickSize] || {}),
        [matId]: val
      }
    }));
  };

  return (
    <div className="pb-32">
      <ScreenHeader
        eyebrow="Configuration"
        title="Recipe Management"
        action={
          <button onClick={onBack} className="w-10 h-10 rounded-full glass-surface-light flex items-center justify-center touch-manipulation">
            <ArrowLeft size={18} className="text-clay-300" />
          </button>
        }
      />

      <div className="px-5 space-y-4">
        <div className="glass-surface-light rounded-2xl p-4 border border-ember-500/20">
          <p className="text-sm text-clay-200">
            Define the exact raw materials required to produce exactly <strong className="text-ember-400">1 Brick</strong> of each size.
          </p>
        </div>

        {(products || []).map(p => (
          <GlassCard key={p.id} padding="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-clay-100 flex items-center gap-2">
              <Factory size={16} className="text-ember-400" /> {p.brickSize}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {(materials || []).map(m => (
                <GlassInput
                  key={m.id}
                  label={`${m.name} (${m.unit})`}
                  type="number"
                  inputMode="decimal"
                  value={(formData[p.brickSize] && formData[p.brickSize][m.id]) || ''}
                  onChange={(e) => handleUpdate(p.brickSize, m.id, e.target.value)}
                />
              ))}
            </div>
            {formData[p.brickSize] && (
               <div className="pt-2 text-right">
                  <p className="text-xs text-clay-400">Total Weight: <span className="text-clay-100 font-semibold">{Object.values(formData[p.brickSize]).reduce((a,b) => a + (Number(b)||0), 0).toFixed(2)} units</span></p>
               </div>
            )}
          </GlassCard>
        ))}

        <GlassButton fullWidth onClick={handleSave} disabled={saving} icon={Save}>
          {saving ? 'Saving…' : 'Save Recipes'}
        </GlassButton>
      </div>
    </div>
  );
}
