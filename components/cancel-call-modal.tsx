'use client';

import React, { useState } from 'react';
import { AlertTriangle, Loader2, X, Clock, Wrench, DollarSign, MapPin, MessageSquare } from 'lucide-react';

interface CancelCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmCancel: (reason: string, note?: string) => Promise<void>;
  isLoading?: boolean;
}

const REASONS = [
  { id: 'Demorou muito para encontrar prestador', label: 'Demorou muito para encontrar prestador', icon: Clock },
  { id: 'Resolvi o problema sozinho', label: 'Resolvi o problema sozinho', icon: Wrench },
  { id: 'Achei o valor alto', label: 'Achei o valor alto', icon: DollarSign },
  { id: 'Endereço ou dados incorretos', label: 'Endereço ou dados incorretos', icon: MapPin },
  { id: 'Outro motivo', label: 'Outro motivo', icon: MessageSquare },
];

export function CancelCallModal({ isOpen, onClose, onConfirmCancel, isLoading = false }: CancelCallModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('Demorou muito para encontrar prestador');
  const [note, setNote] = useState('');

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!selectedReason) return;
    await onConfirmCancel(selectedReason, note.trim() || undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-gray-100 text-left animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-amber-600 font-bold text-sm">
            <AlertTriangle size={18} />
            Confirmar Cancelamento
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <h3 className="text-xl font-black text-gray-900 leading-tight">
          Por que você deseja cancelar o chamado?
        </h3>
        <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
          Sua resposta ajuda a aprimorar a agilidade e a qualidade do atendimento no Repara RV.
        </p>

        {/* Opções de Motivo */}
        <div className="mt-4 space-y-2">
          {REASONS.map((r) => {
            const Icon = r.icon;
            const isSelected = selectedReason === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedReason(r.id)}
                disabled={isLoading}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-xs font-semibold transition cursor-pointer text-left ${
                  isSelected
                    ? 'border-orange-500 bg-orange-50/70 text-orange-950 shadow-xs ring-1 ring-orange-400'
                    : 'border-gray-200 bg-gray-50/50 text-gray-700 hover:bg-gray-100/80 hover:border-gray-300'
                }`}
              >
                <div className={`p-1.5 rounded-lg shrink-0 ${isSelected ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  <Icon size={14} />
                </div>
                <span>{r.label}</span>
              </button>
            );
          })}
        </div>

        {/* Observação Adicional */}
        <div className="mt-4">
          <label className="text-[11px] font-semibold text-gray-500 block mb-1">
            Detalhes adicionais (opcional)
          </label>
          <input
            type="text"
            placeholder="Ex: Consegui emprestar uma chave / vou viajar amanhã"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={isLoading}
            maxLength={140}
            className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
          />
        </div>

        {/* Ações */}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-3 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition cursor-pointer"
          >
            Continuar Aguardando
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex-1 py-3 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:scale-95 rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Cancelando...
              </>
            ) : (
              'Confirmar Cancelamento'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
