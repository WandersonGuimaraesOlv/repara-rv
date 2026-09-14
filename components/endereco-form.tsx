'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, CheckCircle2, AlertCircle } from 'lucide-react';

// Principais e mais populosos bairros de Rio Verde - GO (base expansível)
export const BAIRROS_RIO_VERDE = [
  "Água Santa", "Alvorada", "Bandeirantes", "Bela Vista", "Campestre",
  "Canaã", "Castelo Branco", "Centro", "Cidade Jardim", "Cohab 1 e 2",
  "Dom Miguel", "Gameleira 1 e 2", "Jardim América", "Jardim das Margaridas",
  "Jardim Diniz", "Jardim Floresta", "Jardim Goiás", "Jardim Helena",
  "Jardim Marconal", "Jardim Presidente", "Liberdade", "Maracanã",
  "Medeiros", "Morada do Sol", "Nossa Senhora do Perpétuo Socorro",
  "Nova Vila", "Odília", "Paraíso", "Parque Bandeirantes", "Parque Betânia",
  "Parque das Laranjeiras", "Parque dos Buritis", "Parque dos Girassóis",
  "Pauzanes", "Popular", "Promissão", "Recanto do Bosque", "Residencial Anézio Mendes",
  "Residencial Buriti", "Residencial Canaã", "Residencial Flor do Cerrado",
  "Residencial Gameleira", "Residencial Interlagos", "Residencial Laranjeiras",
  "Residencial Maurício Arantes", "Residencial Monte Sião", "Residencial Park Real",
  "Residencial Solar dos Ataídes", "Residencial Solar Campestre", "Residencial Sun Flower",
  "Residencial Valdeci Pires", "Residencial Veneza", "Santo Agostinho",
  "Santo Antônio", "São João", "São Tomaz", "Serpro", "Setor Central",
  "Setor Industrial / DIMPE", "Setor Morada do Sol", "Setor Pauzanes",
  "Setor Universitário", "Solar dos Ataídes", "Universitário",
  "Vila Amália", "Vila Borges", "Vila Maria", "Vila Mariana",
  "Vila Mutirão", "Vila Olinda", "Vila Rocha", "Vila Santo Antônio"
].sort();

export interface StructuredAddress {
  street: string;
  number: string;
  neighborhood: string;
  reference: string;
  cep?: string;
  fullAddress: string;
}

interface EnderecoFormProps {
  onAddressChange: (address: StructuredAddress | null) => void;
  initialNeighborhood?: string;
}

export function EnderecoForm({ onAddressChange, initialNeighborhood = 'Setor Central' }: EnderecoFormProps) {
  const [cep, setCep] = useState('');
  const [bairro, setBairro] = useState(initialNeighborhood);
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [referencia, setReferencia] = useState('');
  const [loadingCep, setLoadingCep] = useState(false);
  const [cepSuccess, setCepSuccess] = useState(false);

  // Valida e envia o endereço montado para o componente pai
  useEffect(() => {
    const cleanRua = rua.trim();
    const cleanNum = numero.trim();
    const cleanBairro = bairro.trim();
    const cleanRef = referencia.trim();

    // Elimina textos curtos ou aleatórios ("dsada")
    if (cleanRua.length >= 3 && cleanNum.length >= 1 && cleanBairro.length >= 2 && cleanRef.length >= 3) {
      const fullAddress = `${cleanRua}, nº ${cleanNum} - ${cleanBairro} (Ref: ${cleanRef}), Rio Verde - GO`;
      onAddressChange({
        street: cleanRua,
        number: cleanNum,
        neighborhood: cleanBairro,
        reference: cleanRef,
        cep: cep.trim() || undefined,
        fullAddress,
      });
    } else {
      onAddressChange(null);
    }
  }, [rua, numero, bairro, referencia, cep, onAddressChange]);

  // Busca automática ao completar 8 dígitos de CEP (ViaCEP / Rio Verde)
  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '').slice(0, 8);
    setCep(rawValue);
    setCepSuccess(false);

    if (rawValue.length === 8) {
      setLoadingCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${rawValue}/json/`);
        const data = await res.json();

        if (!data.erro) {
          if (data.bairro) setBairro(data.bairro);
          if (data.logradouro) setRua(data.logradouro);
          setCepSuccess(true);
        }
      } catch (err) {
        console.warn('Erro ao consultar ViaCEP:', err);
      } finally {
        setLoadingCep(false);
      }
    }
  };

  const inputBaseClasses =
    "w-full px-3.5 py-2.5 text-sm font-medium rounded-xl transition-all outline-none " +
    "bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 " +
    "text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 " +
    "focus:bg-white dark:focus:bg-slate-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20";

  return (
    <div className="space-y-3.5 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-left transition-colors">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <MapPin size={14} className="text-orange-500 shrink-0" />
          Endereço do Atendimento (Rio Verde)
        </h3>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">Campos obrigatórios *</span>
      </div>

      {/* Campo CEP (Opcional / Agilizador) */}
      <div className="relative">
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
          CEP <span className="text-slate-400 dark:text-slate-500 font-normal">(opcional — preenche rua e bairro sozinho)</span>
        </label>
        <div className="relative">
          <input
            type="tel"
            id="input-address-cep"
            placeholder="75900-000"
            value={cep}
            onChange={handleCepChange}
            maxLength={9}
            className={inputBaseClasses}
          />
          {loadingCep && (
            <span className="absolute right-3 top-2.5 text-xs text-orange-600 dark:text-orange-400 animate-pulse font-medium">
              Buscando...
            </span>
          )}
          {cepSuccess && !loadingCep && (
            <span className="absolute right-3 top-2.5 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
              <CheckCircle2 size={14} /> Localizado
            </span>
          )}
        </div>
      </div>

      {/* Campo Bairro com Busca e Autocomplete Nativo */}
      <div>
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
          Bairro em Rio Verde <span className="text-red-500">*</span>
        </label>
        <input
          list="lista-bairros-rv"
          id="input-address-bairro"
          type="text"
          placeholder="Comece a digitar o bairro (ex: Buriti, Centro...)"
          value={bairro}
          onChange={(e) => setBairro(e.target.value)}
          required
          className={inputBaseClasses}
        />
        <datalist id="lista-bairros-rv">
          {BAIRROS_RIO_VERDE.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
          💡 Digite as primeiras letras para sugestões ou digite livremente se for condomínio novo.
        </p>
      </div>

      {/* Linha Rua + Número */}
      <div className="grid grid-cols-4 gap-2">
        <div className="col-span-3">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
            Rua / Avenida <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="input-address-rua"
            placeholder="Ex: Rua Abel Pereira de Castro"
            value={rua}
            onChange={(e) => setRua(e.target.value)}
            required
            minLength={3}
            className={inputBaseClasses}
          />
        </div>
        <div className="col-span-1">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
            Nº <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="input-address-numero"
            placeholder="123"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            required
            className={
              "w-full px-2 py-2.5 text-sm font-bold text-center rounded-xl transition-all outline-none " +
              "bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 " +
              "text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 " +
              "focus:bg-white dark:focus:bg-slate-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
            }
          />
        </div>
      </div>

      {/* Ponto de Referência (Crucial para o prestador) */}
      <div>
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
          Ponto de Referência <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="input-address-referencia"
          placeholder="Ex: Próximo à pracinha, ao lado da panificadora..."
          value={referencia}
          onChange={(e) => setReferencia(e.target.value)}
          required
          minLength={3}
          className={inputBaseClasses}
        />
        <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1.5 flex items-center gap-1">
          <AlertCircle size={12} className="shrink-0 text-amber-600 dark:text-amber-400" />
          Fundamental para o técnico encontrar sua residência com rapidez.
        </p>
      </div>
    </div>
  );
}
