'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, CheckCircle2, AlertCircle, Lightbulb } from 'lucide-react';

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

  // Busca automática ao completar 8 dígitos de CEP (ViaCEP)
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

  return (
    <div
      className="space-y-3.5 p-4 rounded-2xl text-left"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div className="flex items-center justify-between">
        <h3
          className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <MapPin size={14} style={{ color: 'var(--color-primary)' }} className="shrink-0" />
          Endereço do Atendimento (Rio Verde)
        </h3>
        <span className="text-[10px]" style={{ color: 'var(--color-text-subtle)' }}>
          Campos obrigatórios *
        </span>
      </div>

      {/* Campo CEP */}
      <div className="relative">
        <label htmlFor="input-address-cep" className="label">
          CEP <span className="font-normal" style={{ color: 'var(--color-text-subtle)' }}>(opcional — preenche rua e bairro sozinho)</span>
        </label>
        <div className="relative">
          <input
            type="tel"
            id="input-address-cep"
            placeholder="75900-000"
            value={cep}
            onChange={handleCepChange}
            maxLength={9}
            className="input"
          />
          {loadingCep && (
            <span
              className="absolute right-3 top-3 text-xs font-medium animate-pulse"
              style={{ color: 'var(--color-primary)' }}
            >
              Buscando...
            </span>
          )}
          {cepSuccess && !loadingCep && (
            <span
              className="absolute right-3 top-3 text-xs flex items-center gap-1 font-medium"
              style={{ color: 'var(--color-success)' }}
            >
              <CheckCircle2 size={14} /> Localizado
            </span>
          )}
        </div>
      </div>

      {/* Bairro com Autocomplete */}
      <div>
        <label htmlFor="input-address-bairro" className="label">
          Bairro em Rio Verde <span style={{ color: 'var(--color-danger)' }}>*</span>
        </label>
        <input
          list="lista-bairros-rv"
          id="input-address-bairro"
          type="text"
          placeholder="Comece a digitar o bairro (ex: Buriti, Centro...)"
          value={bairro}
          onChange={(e) => setBairro(e.target.value)}
          required
          className="input"
        />
        <datalist id="lista-bairros-rv">
          {BAIRROS_RIO_VERDE.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
        <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-subtle)' }}>
          <Lightbulb size={12} strokeWidth={2} className="inline-block shrink-0 -mt-0.5 mr-1" aria-hidden="true" />Digite as primeiras letras para sugestões ou digite livremente se for condomínio novo.
        </p>
      </div>

      {/* Linha Rua + Número */}
      <div className="grid grid-cols-4 gap-2">
        <div className="col-span-3">
          <label htmlFor="input-address-rua" className="label">
            Rua / Avenida <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input
            type="text"
            id="input-address-rua"
            placeholder="Ex: Rua Abel Pereira de Castro"
            value={rua}
            onChange={(e) => setRua(e.target.value)}
            required
            minLength={3}
            className="input"
          />
        </div>
        <div className="col-span-1">
          <label htmlFor="input-address-numero" className="label">
            Nº <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input
            type="text"
            id="input-address-numero"
            placeholder="123"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            required
            className="input text-center font-bold"
          />
        </div>
      </div>

      {/* Ponto de Referência */}
      <div>
        <label htmlFor="input-address-referencia" className="label">
          Ponto de Referência <span style={{ color: 'var(--color-danger)' }}>*</span>
        </label>
        <input
          type="text"
          id="input-address-referencia"
          placeholder="Ex: Próximo à pracinha, ao lado da panificadora..."
          value={referencia}
          onChange={(e) => setReferencia(e.target.value)}
          required
          minLength={3}
          className="input"
        />
        <p className="text-[11px] mt-1.5 flex items-center gap-1" style={{ color: 'var(--color-warning)' }}>
          <AlertCircle size={12} className="shrink-0" />
          Fundamental para o técnico encontrar sua residência com rapidez.
        </p>
      </div>
    </div>
  );
}
