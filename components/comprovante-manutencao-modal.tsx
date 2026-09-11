'use client';

import React from 'react';
import { X, Printer, ShieldCheck, CheckCircle2, FileText, MapPin, Calendar, Clock, User, Phone, Wrench } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface ComprovanteProps {
  isOpen: boolean;
  onClose: () => void;
  call: {
    id: string;
    service_name: string;
    total_price: number;
    client_address: string;
    client_name?: string;
    client_phone?: string;
    provider_name?: string;
    completed_at?: string;
    created_at?: string;
  };
}

export function ComprovanteManutencaoModal({ isOpen, onClose, call }: ComprovanteProps) {
  if (!isOpen) return null;

  const dataConclusao = call.completed_at
    ? new Date(call.completed_at).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('pt-BR');

  const horaConclusao = call.completed_at
    ? new Date(call.completed_at).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-gray-100 text-left max-h-[92vh] overflow-y-auto print:max-h-none print:shadow-none print:border-none print:rounded-none print:p-6 animate-slide-up">
        
        {/* Ações superiores na tela */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100 print:hidden">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
            <FileText size={16} className="text-orange-500" />
            Comprovante para Imobiliária / Proprietário
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <Printer size={14} />
              <span>Salvar PDF / Imprimir</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ─── CORPO TIMBRADO DO COMPROVANTE (IMPRESSÃO / PDF) ─── */}
        <div className="space-y-6">
          {/* Cabeçalho */}
          <div className="flex items-start justify-between border-b-2 border-orange-500 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-gray-900">
                  REPARA <span className="text-orange-600">RV</span>
                </span>
                <span className="text-[10px] uppercase font-bold bg-orange-100 text-orange-800 px-2 py-0.5 rounded">
                  Rio Verde - GO
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Comprovante Oficial de Manutenção Residencial
              </p>
              <p className="text-[11px] text-gray-400">
                Documento hábil para prestação de contas, abatimento em aluguel e garantia.
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Protocolo / Chamado</span>
              <span className="font-mono text-sm font-black text-gray-900">
                #{call.id.slice(0, 8).toUpperCase()}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mt-1">
                <CheckCircle2 size={11} /> Serviço Concluído
              </span>
            </div>
          </div>

          {/* Dados do Imóvel & Atendimento */}
          <div className="grid grid-cols-2 gap-4 text-xs bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Local do Reparo (Imóvel)</span>
              <p className="font-bold text-gray-900 flex items-start gap-1">
                <MapPin size={13} className="text-orange-600 shrink-0 mt-0.5" />
                <span>{call.client_address}</span>
              </p>
            </div>

            <div>
              <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Data e Conclusão</span>
              <p className="font-semibold text-gray-800 flex items-center gap-1">
                <Calendar size={13} className="text-gray-500" />
                <span>{dataConclusao} às {horaConclusao}</span>
              </p>
            </div>
          </div>

          {/* Partes Envolvidas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl border border-gray-200">
              <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1.5">Morador / Solicitante</span>
              <p className="font-bold text-gray-900 flex items-center gap-1.5">
                <User size={13} className="text-gray-500" />
                <span>{call.client_name || 'Cliente Repara RV'}</span>
              </p>
              {call.client_phone && (
                <p className="text-gray-500 mt-1 flex items-center gap-1.5">
                  <Phone size={12} className="text-gray-400" />
                  <span>{call.client_phone}</span>
                </p>
              )}
            </div>

            <div className="p-3.5 rounded-xl border border-gray-200">
              <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1.5">Profissional Parceiro Credenciado</span>
              <p className="font-bold text-gray-900 flex items-center gap-1.5">
                <Wrench size={13} className="text-orange-600" />
                <span>{call.provider_name || 'Técnico Homologado Repara RV'}</span>
              </p>
              <p className="text-emerald-700 text-[11px] font-medium mt-1 flex items-center gap-1">
                <ShieldCheck size={12} />
                Identidade e antecedentes criminais verificados
              </p>
            </div>
          </div>

          {/* Discriminação do Reparo & Quitação */}
          <div className="rounded-2xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 flex justify-between text-[11px] font-bold text-gray-600 uppercase tracking-wider">
              <span>Serviço Executado</span>
              <span>Valor Liquidado</span>
            </div>

            <div className="p-4 flex justify-between items-center bg-white border-b border-gray-100">
              <div>
                <p className="font-bold text-gray-900 text-sm">{call.service_name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Mão de obra técnica qualificada com teste de funcionamento e vedação.
                </p>
              </div>
              <span className="text-base font-black text-gray-900">
                {formatCurrency(call.total_price)}
              </span>
            </div>

            <div className="p-4 bg-emerald-50/50 flex justify-between items-center text-xs">
              <div>
                <span className="font-bold text-emerald-950 block">Pagamento Confirmado via Pix</span>
                <span className="text-[11px] text-emerald-800">Transação processada via plataforma Repara RV</span>
              </div>
              <span className="font-mono font-bold text-emerald-700 bg-emerald-100/80 px-2 py-1 rounded">
                QUITADO
              </span>
            </div>
          </div>

          {/* Termo de Garantia e Autenticação */}
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-[11px] text-gray-600 leading-relaxed">
            <p className="font-bold text-gray-800 mb-1 flex items-center gap-1">
              <ShieldCheck size={13} className="text-orange-600" />
              Garantia do Serviço (7 a 30 dias)
            </p>
            <p>
              Este comprovante assegura que o reparo acima foi executado por profissional parceiro verificado do Repara RV. Caso o reparo apresente qualquer defeito decorrente da mão de obra durante o período de garantia, o cliente ou a imobiliária pode reabrir o atendimento pelo site <strong>repararv.com</strong> informando o protocolo <strong>#{call.id.slice(0, 8).toUpperCase()}</strong>.
            </p>
          </div>

          {/* Rodapé institucional */}
          <div className="text-center pt-2 text-[10px] text-gray-400 border-t border-gray-100">
            Repara RV — Intermediação de Serviços Residenciais em Rio Verde - GO • Suporte: contato@repararv.com
          </div>
        </div>
      </div>
    </div>
  );
}
