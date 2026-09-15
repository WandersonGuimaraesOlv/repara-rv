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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" style={{ background: 'rgba(7, 16, 15, 0.8)', backdropFilter: 'blur(8px)' }}>
      <div
        className="rounded-3xl p-6 max-w-md w-full shadow-2xl text-left animate-slide-up"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 font-bold text-sm" style={{ color: 'var(--color-warning)' }}>
            <AlertTriangle size={18} />
            Confirmar Cancelamento
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="p-1 rounded-full transition cursor-pointer hover:opacity-80"
            style={{ color: 'var(--color-text-subtle)' }}
          >
            <X size={18} />
          </button>
        </div>

        <h3 className="text-xl font-black leading-tight" style={{ color: 'var(--color-text)' }}>
          Por que você deseja cancelar o chamado?
        </h3>
        <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
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
                className="w-full flex items-center gap-3 p-3 rounded-xl border text-xs font-semibold transition cursor-pointer text-left"
                style={{
                  background: isSelected ? 'var(--color-primary-soft)' : 'var(--color-surface-alt)',
                  borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                  color: isSelected ? 'var(--color-accent)' : 'var(--color-text)',
                }}
              >
                <div
                  className="p-1.5 rounded-lg shrink-0"
                  style={{
                    background: isSelected ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.05)',
                    color: isSelected ? '#ffffff' : 'var(--color-text-subtle)',
                  }}
                >
                  <Icon size={14} />
                </div>
                <span>{r.label}</span>
              </button>
            );
          })}
        </div>

        {/* Observação Adicional */}
        <div className="mt-4">
          <label className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--color-text-muted)' }}>
            Detalhes adicionais (opcional)
          </label>
          <input
            type="text"
            placeholder="Ex: Consegui emprestar uma chave / vou viajar amanhã"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={isLoading}
            maxLength={140}
            className="input"
          />
        </div>

        {/* Ações */}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="btn-secondary flex-1 py-3 text-xs"
          >
            Continuar Aguardando
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className="btn-danger flex-1 py-3 text-xs flex items-center justify-center gap-2"
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
