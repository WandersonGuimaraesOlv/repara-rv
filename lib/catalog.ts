import { QuickService } from './types'

export const DEFAULT_SERVICES: QuickService[] = [
  // ── Elétrica ──
  {
    id: '8b5c4095-e56f-4066-80c4-37f359ee47c2',
    name: 'Troca de Chuveiro / Resistência',
    category: 'Elétrica',
    description: 'Substituição de chuveiro ou resistência elétrica com teste de funcionamento e vedação.',
    fixed_price: 70.0,
    platform_fee: 12.0,
    icon: 'ShowerHead',
    color: '#F59E0B',
    sort_order: 1,
    is_active: true,
  },
  {
    id: '88b9104b-be4f-4b44-a6cf-5eff3748b60b',
    name: 'Troca de Tomada / Interruptor / Lâmpada',
    category: 'Elétrica',
    description: 'Instalação ou substituição de tomadas, interruptores e lâmpadas residenciais.',
    fixed_price: 50.0,
    platform_fee: 12.0,
    icon: 'Plug',
    color: '#F59E0B',
    sort_order: 2,
    is_active: true,
  },
  {
    id: '2a09df38-84b4-4853-bdff-338e27981930',
    name: 'Instalação de Ventilador de Teto',
    category: 'Elétrica',
    description: 'Montagem e instalação elétrica de ventilador de teto com suporte e balanceamento.',
    fixed_price: 120.0,
    platform_fee: 12.0,
    icon: 'Fan',
    color: '#F59E0B',
    sort_order: 3,
    is_active: true,
  },
  {
    id: 'c6663a89-bab1-465f-937e-a4b366350cc7',
    name: 'Instalação de Plafon / Painel LED',
    category: 'Elétrica',
    description: 'Fixação e ligação elétrica de luminárias de sobrepor ou embutir tipo plafon / LED.',
    fixed_price: 60.0,
    platform_fee: 12.0,
    icon: 'Lightbulb',
    color: '#F59E0B',
    sort_order: 4,
    is_active: true,
  },
  {
    id: '4b58ef09-8b01-49b8-a621-eef671239920',
    name: 'Troca de Disjuntor / Pane Elétrica',
    category: 'Elétrica',
    description: 'Diagnóstico de sobrecarga, substituição de disjuntor defeituoso no quadro geral.',
    fixed_price: 80.0,
    platform_fee: 12.0,
    icon: 'zap',
    color: '#F59E0B',
    sort_order: 5,
    is_active: true,
  },

  // ── Hidráulica ──
  {
    id: '1e6d94df-5e8d-49ec-9c1b-6d30f99b9529',
    name: 'Troca de Torneira / Sifão de Pia',
    category: 'Hidráulica',
    description: 'Substituição de torneira, flexível ou sifão de pia com fita veda-rosca e teste de estanqueidade.',
    fixed_price: 60.0,
    platform_fee: 12.0,
    icon: 'Droplet',
    color: '#06B6D4',
    sort_order: 6,
    is_active: true,
  },
  {
    id: 'f1698097-5802-4a0f-b529-5003490c2855',
    name: 'Desentupimento de Ralo / Vaso Sanitário',
    category: 'Hidráulica',
    description: 'Desobstrução rápida de encanamento de ralo, pia ou vaso sanitário com equipamento manual.',
    fixed_price: 100.0,
    platform_fee: 12.0,
    icon: 'Pipette',
    color: '#06B6D4',
    sort_order: 7,
    is_active: true,
  },
  {
    id: '4cf805b2-09f3-4ecb-8623-11a687e0ae39',
    name: 'Reparo de Caixa Acoplada',
    category: 'Hidráulica',
    description: 'Ajuste ou troca de mecanismo de entrada/saída, boia e vedação de caixa acoplada.',
    fixed_price: 70.0,
    platform_fee: 12.0,
    icon: 'Wrench',
    color: '#06B6D4',
    sort_order: 8,
    is_active: true,
  },
  {
    id: '5ed20888-b613-47e6-8ae7-83020a3c0914',
    name: 'Vedação de Box / Pia com Silicone',
    category: 'Hidráulica',
    description: 'Aplicação de silicone antifungo para vedação perfeita contra infiltração em pias e box.',
    fixed_price: 60.0,
    platform_fee: 12.0,
    icon: 'ShieldCheck',
    color: '#06B6D4',
    sort_order: 9,
    is_active: true,
  },
  {
    id: '7a1e5052-19e4-4d89-b873-12502ef56291',
    name: 'Reparo de Válvula de Descarga (Hydra/Docol)',
    category: 'Hidráulica',
    description: 'Substituição do cartucho e vedação de válvula de descarga embutida com regulagem.',
    fixed_price: 80.0,
    platform_fee: 12.0,
    icon: 'Droplet',
    color: '#06B6D4',
    sort_order: 10,
    is_active: true,
  },
  {
    id: '3f990145-2e6b-4e12-870e-3fa128cd6109',
    name: 'Troca / Reparo Torneira com Misturador',
    category: 'Hidráulica',
    description: 'Instalação ou conserto de torneira monocomando ou misturador de água quente/fria.',
    fixed_price: 80.0,
    platform_fee: 12.0,
    icon: 'Droplet',
    color: '#06B6D4',
    sort_order: 11,
    is_active: true,
  },
  {
    id: '9d82136e-5a7c-47b2-bdcf-8869c9b13922',
    name: 'Troca ou Instalação de Vaso Sanitário',
    category: 'Hidráulica',
    description: 'Remoção de louça antiga, fixação de novo vaso com anel de cera, bolsa e vedação de silicone.',
    fixed_price: 120.0,
    platform_fee: 12.0,
    icon: 'Wrench',
    color: '#06B6D4',
    sort_order: 12,
    is_active: true,
  },

  // ── Montagem e Fixação ──
  {
    id: 'db0b0819-8a5a-49bc-8faa-a393c2b65cc4',
    name: 'Fixação de Suporte de TV / Cortina / Quadro',
    category: 'Montagem',
    description: 'Perfuração precisa em alvenaria e fixação segura de suporte de TV, varão de cortina ou nichos.',
    fixed_price: 70.0,
    platform_fee: 12.0,
    icon: 'Tv',
    color: '#8B5CF6',
    sort_order: 13,
    is_active: true,
  },
  {
    id: '966fea9b-d7eb-483f-9309-c971d64d2b77',
    name: 'Montagem / Desmontagem Móvel Pequeno',
    category: 'Montagem',
    description: 'Montagem de móveis avulsos como mesas de cabeceira, cadeiras de escritório, sapateiras e mesas.',
    fixed_price: 90.0,
    platform_fee: 12.0,
    icon: 'Hammer',
    color: '#8B5CF6',
    sort_order: 14,
    is_active: true,
  },
  {
    id: 'fb25cfbe-3e7c-4107-bcbe-f40124e09599',
    name: 'Instalação de Varal de Teto / Parede',
    category: 'Montagem',
    description: 'Fixação firme e alinhamento de varal articulado ou de teto com cordas e roldanas.',
    fixed_price: 80.0,
    platform_fee: 12.0,
    icon: 'Shirt',
    color: '#8B5CF6',
    sort_order: 15,
    is_active: true,
  },
  {
    id: 'bc59db09-9149-4eb8-a57c-659f195ff8d5',
    name: 'Regulagem de Dobradiças e Gavetas',
    category: 'Montagem',
    description: 'Alinhamento de portas de armários desreguladas, troca de puxadores e ajuste de trilhos de gaveta.',
    fixed_price: 60.0,
    platform_fee: 12.0,
    icon: 'Settings2',
    color: '#8B5CF6',
    sort_order: 16,
    is_active: true,
  },

  // ── Chaveiro ──
  {
    id: '15dc3813-d19e-4c09-9dc9-7690a3141a1b',
    name: 'Abertura de Porta (Bateu-Fechou)',
    category: 'Chaveiro',
    description: 'Abertura rápida e sem danos de portas residenciais trancadas acidentalmente.',
    fixed_price: 100.0,
    platform_fee: 12.0,
    icon: 'Key',
    color: '#EAB308',
    sort_order: 17,
    is_active: true,
  },
  {
    id: 'd8505766-6373-460c-acd2-34bfb0372b46',
    name: 'Troca de Fechadura / Miolo de Porta',
    category: 'Chaveiro',
    description: 'Substituição completa de fechadura de sobrepor ou miolo de cilindro para nova chave.',
    fixed_price: 80.0,
    platform_fee: 12.0,
    icon: 'Lock',
    color: '#EAB308',
    sort_order: 18,
    is_active: true,
  },

  // ── Instalação & Eletrodomésticos ──
  {
    id: '65943f94-fdd6-48a1-a3d0-ffbb6dd88def',
    name: 'Instalação de Máquina de Lavar',
    category: 'Instalação',
    description: 'Conexão hidráulica (entrada/saída de água), nivelamento dos pés e teste de centrifugação.',
    fixed_price: 70.0,
    platform_fee: 12.0,
    icon: 'WashingMachine',
    color: '#10B981',
    sort_order: 19,
    is_active: true,
  },
  {
    id: '53102e50-835e-4132-a4f3-02929e52e44b',
    name: 'Troca de Mangueira e Registro de Gás',
    category: 'Instalação',
    description: 'Troca preventiva de mangueira trançada e regulador de pressão de gás com teste de espuma de sabão.',
    fixed_price: 50.0,
    platform_fee: 12.0,
    icon: 'Flame',
    color: '#10B981',
    sort_order: 20,
    is_active: true,
  },
]

export function getServiceScope(serviceName = '', category = ''): { included: string[]; not_included: string[] } {
  const name = serviceName.toLowerCase()

  if (name.includes('chuveiro') || name.includes('resistência')) {
    return {
      included: [
        'Mão de obra para desmontagem e nova instalação',
        'Fita veda-rosca (teflon) e conectores elétricos de engate',
        'Teste completo de temperatura (fria e quente) e verificação de vazamento',
      ],
      not_included: [
        'O chuveiro novo ou resistência nova (devem ser fornecidos pelo cliente)',
        'Passagem de nova fiação até o quadro de distribuição',
        'Troca do disjuntor geral (orçado à parte caso necessário)',
      ],
    }
  }

  if (name.includes('torneira') || name.includes('sifão')) {
    return {
      included: [
        'Retirada da torneira ou sifão danificado',
        'Instalação com fita veda-rosca de alta densidade',
        'Teste rigoroso de estanqueidade e fluxo de água',
      ],
      not_included: [
        'A torneira nova, flexível ou sifão novo (fornecidos pelo cliente)',
        'Quebra de alvenaria ou reparos estruturais de encanamento interno',
        'Troca de cuba ou reparo na bancada de mármore',
      ],
    }
  }

  if (name.includes('ventilador')) {
    return {
      included: [
        'Montagem das pás e acoplamento do motor',
        'Fixação no teto, balanceamento e alinhamento das hélices',
        'Ligação na rede elétrica existente e teste de rotação/velocidade',
      ],
      not_included: [
        'O ventilador de teto novo na caixa (fornecido pelo cliente)',
        'Passagem de novos conduítes ou fiação estrutural pela laje',
        'Reforço de sustentação em forros de gesso ou drywall rebaixados',
      ],
    }
  }

  if (name.includes('tomada') || name.includes('interruptor') || name.includes('lâmpada')) {
    return {
      included: [
        'Desconexão segura do ponto elétrico desenergizado',
        'Fixação de novo espelho, interruptor, tomada ou soquete',
        'Teste de voltagem (110V/220V) com multímetro no local',
      ],
      not_included: [
        'O conjunto de tomada, espelho ou lâmpadas novas (fornecidos pelo cliente)',
        'Recabeamento completo ou troca da fiação interna do imóvel',
      ],
    }
  }

  if (name.includes('desentupimento')) {
    return {
      included: [
        'Desobstrução mecânica especializada de ralo, vaso ou pia',
        'Remoção de resíduos e limpeza inicial do ponto de escoamento',
        'Teste de vazão e esgotamento pleno com água corrente',
      ],
      not_included: [
        'Obras de troca de prumada ou tubulações de esgoto quebradas',
        'Caminhão limpa-fossa para esgotamento geral de fossa séptica',
      ],
    }
  }

  if (name.includes('suporte de tv') || name.includes('cortina') || name.includes('quadro')) {
    return {
      included: [
        'Furação com furadeira de impacto e broca apropriada para a parede',
        'Nivelamento preciso com nível bolha ou laser',
        'Buchas e parafusos padrão de fixação reforçada',
      ],
      not_included: [
        'O suporte de TV, varão de cortina ou quadros (fornecidos pelo cliente)',
        'Passagem de cabos HDMI ou fiação embutida dentro da alvenaria',
      ],
    }
  }

  if (name.includes('fechadura') || name.includes('porta')) {
    return {
      included: [
        'Mão de obra de desmontagem e assentamento do novo miolo ou fechadura',
        'Ajuste fino no batente para travamento suave e sem atrito',
        'Teste completo de chave e tranca de segurança',
      ],
      not_included: [
        'A fechadura nova, miolo ou cópias extras de chaves (fornecidos pelo cliente)',
        'Restauração de portas estufadas ou madeiramento podre',
      ],
    }
  }

  // Fallback padrão universal
  return {
    included: [
      'Mão de obra técnica especializada com ferramentas completas',
      'Execução, testes de funcionamento e segurança no local',
      'Limpeza básica do local de trabalho e descarte dos materiais substituídos',
    ],
    not_included: [
      'O produto, aparelho ou peça nova a ser instalada (fornecidos pelo cliente)',
      'Materiais pesados de construção civil, reformas de alvenaria ou pintura',
      'Serviços elétricos ou hidráulicos estruturais que exijam quebra de paredes',
    ],
  }
}
