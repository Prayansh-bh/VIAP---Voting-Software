/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  LayoutDashboard,
  Users,
  Building2,
  Layers,
  BarChart3,
  Megaphone,
  Vote,
  Network,
  Bot,
  LogOut,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Phone,
  MessageSquare,
  Sparkles,
  Trophy,
  Copy,
  Download,
  Share2,
  Globe,
  ArrowLeft,
  ChevronRight,
  ShieldAlert,
  Flame,
  CheckSquare,
  Award
} from 'lucide-react';
import { UserSession } from '../types';
import { useCms } from '../context/CmsContext';
import AIStrategicIntelligenceCenter from './AIStrategicIntelligenceCenter';

interface StateDashboardProps {
  session: UserSession;
  onLogout: () => void;
}

type StateTabType =
  | 'dashboard'
  | 'constituency_list'
  | 'parliament_list'
  | 'zone_list'
  | 'ground_reports'
  | 'campaign'
  | 'poll'
  | 'cadre_network'
  | 'ai_intel';

// 119 Telangana Assembly Constituencies
const ALL_TELANGANA_CONSTITUENCIES = [
  { id: 1, name: 'Sirpur', district: 'Komaram Bheem Asifabad', parliament: 'Adilabad', incharge: 'Dr. P. Harish Rao', phone: '+91 98480 11001', voters: 218450, incVotes: 64200, brsVotes: 78100, bjpVotes: 42000, mimVotes: 3200, neutralVotes: 21000, fakeVotes: 450, status: 'TRAILING' as const, margin: '13,900' },
  { id: 2, name: 'Chennur (SC)', district: 'Mancherial', parliament: 'Peddapalle', incharge: 'G. Vivek Venkatswamy', phone: '+91 98480 11002', voters: 189200, incVotes: 88400, brsVotes: 51200, bjpVotes: 18400, mimVotes: 1200, neutralVotes: 18500, fakeVotes: 320, status: 'WINNING' as const, margin: '37,200' },
  { id: 3, name: 'Bellampalli (SC)', district: 'Mancherial', parliament: 'Peddapalle', incharge: 'G. Vinod', phone: '+91 98480 11003', voters: 172400, incVotes: 82100, brsVotes: 48900, bjpVotes: 14200, mimVotes: 800, neutralVotes: 16100, fakeVotes: 280, status: 'WINNING' as const, margin: '33,200' },
  { id: 4, name: 'Mancherial', district: 'Mancherial', parliament: 'Peddapalle', incharge: 'K. Prem Sagar Rao', phone: '+91 98480 11004', voters: 254100, incVotes: 105800, brsVotes: 68400, bjpVotes: 38200, mimVotes: 2100, neutralVotes: 24200, fakeVotes: 510, status: 'WINNING' as const, margin: '37,400' },
  { id: 5, name: 'Asifabad (ST)', district: 'Komaram Bheem Asifabad', parliament: 'Adilabad', incharge: 'Ajmera Shyam', phone: '+91 98480 11005', voters: 210800, incVotes: 71200, brsVotes: 84100, bjpVotes: 24300, mimVotes: 1100, neutralVotes: 19800, fakeVotes: 420, status: 'TRAILING' as const, margin: '12,900' },
  { id: 6, name: 'Khanapur (ST)', district: 'Nirmal', parliament: 'Adilabad', incharge: 'Vedma Bhojju', phone: '+91 98480 11006', voters: 224600, incVotes: 88200, brsVotes: 66400, bjpVotes: 35100, mimVotes: 900, neutralVotes: 20100, fakeVotes: 380, status: 'WINNING' as const, margin: '21,800' },
  { id: 7, name: 'Adilabad', district: 'Adilabad', parliament: 'Adilabad', incharge: 'K. Sanjeev Reddy', phone: '+91 98480 11007', voters: 238900, incVotes: 61400, brsVotes: 68100, bjpVotes: 74200, mimVotes: 6200, neutralVotes: 22100, fakeVotes: 490, status: 'TRAILING' as const, margin: '6,100' },
  { id: 8, name: 'Boath (ST)', district: 'Adilabad', parliament: 'Adilabad', incharge: 'G. Nagesh', phone: '+91 98480 11008', voters: 198300, incVotes: 68400, brsVotes: 74200, bjpVotes: 28100, mimVotes: 800, neutralVotes: 17900, fakeVotes: 310, status: 'TRAILING' as const, margin: '5,800' },
  { id: 9, name: 'Nirmal', district: 'Nirmal', parliament: 'Adilabad', incharge: 'Srihari Rao', phone: '+91 98480 11009', voters: 242000, incVotes: 65100, brsVotes: 62400, bjpVotes: 82100, mimVotes: 3100, neutralVotes: 21800, fakeVotes: 420, status: 'TRAILING' as const, margin: '17,000' },
  { id: 10, name: 'Mudhole', district: 'Nirmal', parliament: 'Adilabad', incharge: 'P. Rama Rao Pawar', phone: '+91 98480 11010', voters: 231500, incVotes: 62400, brsVotes: 59100, bjpVotes: 78400, mimVotes: 2200, neutralVotes: 21100, fakeVotes: 390, status: 'TRAILING' as const, margin: '16,000' },
  { id: 11, name: 'Armoor', district: 'Nizamabad', parliament: 'Nizamabad', incharge: 'P. Vinay Kumar Reddy', phone: '+91 98480 11011', voters: 202400, incVotes: 58200, brsVotes: 56100, bjpVotes: 69400, mimVotes: 1200, neutralVotes: 18500, fakeVotes: 340, status: 'TRAILING' as const, margin: '11,200' },
  { id: 12, name: 'Bodhan', district: 'Nizamabad', parliament: 'Nizamabad', incharge: 'P. Sudarshan Reddy', phone: '+91 98480 11012', voters: 219800, incVotes: 86400, brsVotes: 72100, bjpVotes: 28400, mimVotes: 5200, neutralVotes: 20200, fakeVotes: 410, status: 'WINNING' as const, margin: '14,300' },
  { id: 13, name: 'Jukkal (SC)', district: 'Kamareddy', parliament: 'Zahirabad', incharge: 'Thota Laxmi Kantha Rao', phone: '+91 98480 11013', voters: 195600, incVotes: 79200, brsVotes: 68100, bjpVotes: 21400, mimVotes: 800, neutralVotes: 18100, fakeVotes: 290, status: 'WINNING' as const, margin: '11,100' },
  { id: 14, name: 'Banswada', district: 'Kamareddy', parliament: 'Zahirabad', incharge: 'E. Ravinder Reddy', phone: '+91 98480 11014', voters: 201300, incVotes: 78100, brsVotes: 73400, bjpVotes: 22100, mimVotes: 900, neutralVotes: 18900, fakeVotes: 310, status: 'WINNING' as const, margin: '4,700' },
  { id: 15, name: 'Yellareddy', district: 'Kamareddy', parliament: 'Zahirabad', incharge: 'K. Madan Mohan Rao', phone: '+91 98480 11015', voters: 214700, incVotes: 89400, brsVotes: 65100, bjpVotes: 27800, mimVotes: 1100, neutralVotes: 21200, fakeVotes: 350, status: 'WINNING' as const, margin: '24,300' },
  { id: 16, name: 'Kamareddy', district: 'Kamareddy', parliament: 'Zahirabad', incharge: 'K. Venkata Ramana Reddy', phone: '+91 98480 11016', voters: 245900, incVotes: 64200, brsVotes: 65100, bjpVotes: 74800, mimVotes: 2800, neutralVotes: 23800, fakeVotes: 480, status: 'TRAILING' as const, margin: '9,700' },
  { id: 17, name: 'Nizamabad Urban', district: 'Nizamabad', parliament: 'Nizamabad', incharge: 'Mohd Ali Shabbir', phone: '+91 98480 11017', voters: 278000, incVotes: 68400, brsVotes: 61200, bjpVotes: 89400, mimVotes: 14200, neutralVotes: 26800, fakeVotes: 620, status: 'TRAILING' as const, margin: '21,000' },
  { id: 18, name: 'Nizamabad Rural', district: 'Nizamabad', parliament: 'Nizamabad', incharge: 'R. Bhupathi Reddy', phone: '+91 98480 11018', voters: 246500, incVotes: 94200, brsVotes: 72100, bjpVotes: 46200, mimVotes: 2100, neutralVotes: 23100, fakeVotes: 410, status: 'WINNING' as const, margin: '22,100' },
  { id: 19, name: 'Kodangal', district: 'Vikarabad', parliament: 'Mahabubnagar', incharge: 'A. Revanth Reddy', phone: '+91 98480 11050', voters: 236500, incVotes: 108400, brsVotes: 76200, bjpVotes: 21400, mimVotes: 1100, neutralVotes: 21200, fakeVotes: 380, status: 'WINNING' as const, margin: '32,200' },
  { id: 20, name: 'Nalgonda', district: 'Nalgonda', parliament: 'Nalgonda', incharge: 'Komatireddy Venkat Reddy', phone: '+91 98480 11051', voters: 248900, incVotes: 118200, brsVotes: 64100, bjpVotes: 24100, mimVotes: 1800, neutralVotes: 22400, fakeVotes: 420, status: 'WINNING' as const, margin: '54,100' },
  { id: 21, name: 'Huzurnagar', district: 'Suryapet', parliament: 'Nalgonda', incharge: 'N. Uttam Kumar Reddy', phone: '+91 98480 11052', voters: 258100, incVotes: 116400, brsVotes: 71200, bjpVotes: 26800, mimVotes: 1200, neutralVotes: 23400, fakeVotes: 450, status: 'WINNING' as const, margin: '45,200' },
  { id: 22, name: 'Madhira (SC)', district: 'Khammam', parliament: 'Khammam', incharge: 'Mallu Bhatti Vikramarka', phone: '+91 98480 11053', voters: 224500, incVotes: 108900, brsVotes: 62400, bjpVotes: 14200, mimVotes: 900, neutralVotes: 20100, fakeVotes: 340, status: 'WINNING' as const, margin: '46,500' },
  { id: 23, name: 'Khammam', district: 'Khammam', parliament: 'Khammam', incharge: 'Thummala Nageswara Rao', phone: '+91 98480 11054', voters: 310200, incVotes: 136400, brsVotes: 87100, bjpVotes: 32100, mimVotes: 3400, neutralVotes: 28900, fakeVotes: 580, status: 'WINNING' as const, margin: '49,300' },
  { id: 24, name: 'Palair', district: 'Khammam', parliament: 'Khammam', incharge: 'Ponguleti Srinivasa Reddy', phone: '+91 98480 11055', voters: 242600, incVotes: 121400, brsVotes: 65100, bjpVotes: 18200, mimVotes: 1100, neutralVotes: 21800, fakeVotes: 410, status: 'WINNING' as const, margin: '56,300' },
  { id: 25, name: 'Jubilee Hills', district: 'Hyderabad', parliament: 'Secunderabad', incharge: 'Md. Azharuddin', phone: '+91 98480 11060', voters: 382400, incVotes: 84200, brsVotes: 101400, bjpVotes: 98100, mimVotes: 18400, neutralVotes: 36200, fakeVotes: 980, status: 'TRAILING' as const, margin: '17,200' },
  { id: 26, name: 'Khairatabad', district: 'Hyderabad', parliament: 'Secunderabad', incharge: 'P. Vijaya Reddy', phone: '+91 98480 11061', voters: 295100, incVotes: 71200, brsVotes: 88400, bjpVotes: 74200, mimVotes: 11800, neutralVotes: 27100, fakeVotes: 640, status: 'TRAILING' as const, margin: '14,200' },
  { id: 27, name: 'Serilingampally', district: 'Rangareddy', parliament: 'Chevella', incharge: 'V. Jagadeeshwar Goud', phone: '+91 98480 11062', voters: 712000, incVotes: 164200, brsVotes: 228400, bjpVotes: 189100, mimVotes: 14200, neutralVotes: 68100, fakeVotes: 1420, status: 'TRAILING' as const, margin: '64,200' },
  { id: 28, name: 'Kukatpally', district: 'Medchal-Malkajgiri', parliament: 'Malkajgiri', incharge: 'Bandi Ramesh', phone: '+91 98480 11063', voters: 489000, incVotes: 118200, brsVotes: 172400, bjpVotes: 124100, mimVotes: 9800, neutralVotes: 44200, fakeVotes: 980, status: 'TRAILING' as const, margin: '54,200' }
];

// 17 Parliaments of Telangana
const TELANGANA_17_PARLIAMENTS = [
  { id: 1, name: 'Adilabad', candidate: 'Dr. Suguna Kumari', margin: '+4.5%', incVotes: 412000, brsVotes: 382000, bjpVotes: 342000, voters: 1485000, status: 'WINNING' as const, incharge: 'G. Ramaiah', phone: '+91 98480 20001' },
  { id: 2, name: 'Peddapalle', candidate: 'G. Vamshi Krishna', margin: '+18.2%', incVotes: 524000, brsVotes: 324000, bjpVotes: 218000, voters: 1540000, status: 'WINNING' as const, incharge: 'M. Sathaiah', phone: '+91 98480 20002' },
  { id: 3, name: 'Karimnagar', candidate: 'Velchala Rajender Rao', margin: '-3.8%', incVotes: 448000, brsVotes: 462000, bjpVotes: 478000, voters: 1650000, status: 'TRAILING' as const, incharge: 'P. Srinivas', phone: '+91 98480 20003' },
  { id: 4, name: 'Nizamabad', candidate: 'T. Jeevan Reddy', margin: '-4.1%', incVotes: 462000, brsVotes: 451000, bjpVotes: 488000, voters: 1590000, status: 'TRAILING' as const, incharge: 'S. Mohan', phone: '+91 98480 20004' },
  { id: 5, name: 'Zahirabad', candidate: 'Suresh Kumar Shetkar', margin: '+6.8%', incVotes: 498000, brsVotes: 432000, bjpVotes: 248000, voters: 1510000, status: 'WINNING' as const, incharge: 'K. Shankar', phone: '+91 98480 20005' },
  { id: 6, name: 'Medak', candidate: 'Neelam Madhu', margin: '+3.2%', incVotes: 485000, brsVotes: 452000, bjpVotes: 268000, voters: 1620000, status: 'WINNING' as const, incharge: 'R. Shekhar', phone: '+91 98480 20006' },
  { id: 7, name: 'Malkajgiri', candidate: 'Sunitha Mahender Reddy', margin: '-5.2%', incVotes: 720000, brsVotes: 765000, bjpVotes: 812000, voters: 3150000, status: 'TRAILING' as const, incharge: 'Ch. Harinath', phone: '+91 98480 20007' },
  { id: 8, name: 'Secunderabad', candidate: 'Danam Nagender', margin: '-6.4%', incVotes: 410000, brsVotes: 428000, bjpVotes: 485000, voters: 1980000, status: 'TRAILING' as const, incharge: 'B. Mahesh', phone: '+91 98480 20008' },
  { id: 9, name: 'Hyderabad', candidate: 'Mohammed Waliullah', margin: '-19.5%', incVotes: 290000, brsVotes: 182000, bjpVotes: 324000, voters: 2150000, status: 'TRAILING' as const, incharge: 'Feroz Khan', phone: '+91 98480 20009' },
  { id: 10, name: 'Chevella', candidate: 'G. Ranjith Reddy', margin: '+8.1%', incVotes: 615000, brsVotes: 512000, bjpVotes: 442000, voters: 2540000, status: 'WINNING' as const, incharge: 'K. Pratap', phone: '+91 98480 20010' },
  { id: 11, name: 'Mahabubnagar', candidate: 'Challa Vamshi Chand Reddy', margin: '+9.4%', incVotes: 512000, brsVotes: 418000, bjpVotes: 234000, voters: 1590000, status: 'WINNING' as const, incharge: 'V. Krishna', phone: '+91 98480 20011' },
  { id: 12, name: 'Nagarkurnool', candidate: 'Mallu Ravi', margin: '+12.7%', incVotes: 538000, brsVotes: 392000, bjpVotes: 184000, voters: 1530000, status: 'WINNING' as const, incharge: 'D. Rajesh', phone: '+91 98480 20012' },
  { id: 13, name: 'Nalgonda', candidate: 'K. Raghuveer Reddy', margin: '+24.5%', incVotes: 642000, brsVotes: 382000, bjpVotes: 164000, voters: 1680000, status: 'WINNING' as const, incharge: 'S. Narender', phone: '+91 98480 20013' },
  { id: 14, name: 'Bhongir', candidate: 'Chamala Kiran Kumar Reddy', margin: '+16.9%', incVotes: 580000, brsVotes: 394000, bjpVotes: 218000, voters: 1720000, status: 'WINNING' as const, incharge: 'M. Venkat', phone: '+91 98480 20014' },
  { id: 15, name: 'Warangal', candidate: 'Kadiyam Kavya', margin: '+19.8%', incVotes: 595000, brsVotes: 362000, bjpVotes: 248000, voters: 1780000, status: 'WINNING' as const, incharge: 'T. Prakash', phone: '+91 98480 20015' },
  { id: 16, name: 'Mahabubabad', candidate: 'Porika Balaram Naik', margin: '+15.3%', incVotes: 521000, brsVotes: 351000, bjpVotes: 174000, voters: 1490000, status: 'WINNING' as const, incharge: 'B. Ravinder', phone: '+91 98480 20016' },
  { id: 17, name: 'Khammam', candidate: 'Ramasahayam Raghuram Reddy', margin: '+32.1%', incVotes: 712000, brsVotes: 342000, bjpVotes: 148000, voters: 1640000, status: 'WINNING' as const, incharge: 'P. Sambasiva Rao', phone: '+91 98480 20017' }
];

// 5 Zones
const TELANGANA_5_ZONES = [
  { name: 'North Telangana', coordinator: 'K. Sudhakar Reddy', phone: '+91 98480 30001', parliaments: ['Adilabad', 'Nizamabad', 'Karimnagar', 'Peddapalli'], assembliesCount: 28, projectedWins: 18, voters: '6.2M', voteShare: '43.8%' },
  { name: 'South Telangana', coordinator: 'V. Damodar Reddy', phone: '+91 98480 30002', parliaments: ['Mahabubnagar', 'Nagarkurnool', 'Chevella'], assembliesCount: 21, projectedWins: 21, voters: '5.9M', voteShare: '49.0%' },
  { name: 'East Telangana', coordinator: 'B. Prabhakar', phone: '+91 98480 30003', parliaments: ['Khammam', 'Mahabubabad', 'Warangal', 'Nalgonda'], assembliesCount: 30, projectedWins: 26, voters: '7.9M', voteShare: '52.1%' },
  { name: 'West Telangana', coordinator: 'M. Anand Kumar', phone: '+91 98480 30004', parliaments: ['Zahirabad', 'Medak', 'Bhongir'], assembliesCount: 21, projectedWins: 14, voters: '6.4M', voteShare: '44.2%' },
  { name: 'Greater Hyderabad', coordinator: 'G. Madhu Goud', phone: '+91 98480 30005', parliaments: ['Hyderabad', 'Secunderabad', 'Malkajgiri'], assembliesCount: 19, projectedWins: 3, voters: '7.2M', voteShare: '29.4%' }
];

export default function StateDashboard({ session, onLogout }: StateDashboardProps) {
  const { config } = useCms();
  const [activeTab, setActiveTab] = useState<StateTabType>('dashboard');
  const [assemblyFilter, setAssemblyFilter] = useState<'all' | 'winning' | 'trailing'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [viewingMandalConstituency, setViewingMandalConstituency] = useState<string | null>(null);

  // Campaign State
  const [campaignPrompt, setCampaignPrompt] = useState('');
  const [campaignLang, setCampaignLang] = useState('Telugu');
  const [campaignTone, setCampaignTone] = useState('Inspirational');
  const [campaignGeneratedMsg, setCampaignGeneratedMsg] = useState(
    'నమస్కారం! కాంగ్రెస్ ప్రభుత్వం ఇచ్చిన 6 గ్యారంటీలలో భాగమైన మహాలక్ష్మి పథకం ద్వారా మహిళలకు ఉచిత బస్సు ప్రయాణం & నెలకు ₹2,500 సాయం అందుతోంది. ప్రజా పాలన కోసం కాంగ్రెస్‌తో కలిసి నడవండి!'
  );
  const [copiedToast, setCopiedToast] = useState(false);

  // Poll State
  const [pollTopic, setPollTopic] = useState('');
  const [pollTarget, setPollTarget] = useState('All Cadre');
  const [pollOptions, setPollOptions] = useState(['Highly Satisfied', 'Satisfied', 'Need Improvement', 'Not Aware']);
  const [activePolls, setActivePolls] = useState([
    {
      id: 1,
      title: 'Free RTC Bus Travel Scheme (Mahalakshmi) Public Feedback',
      responses: 48920,
      timestamp: 'Active • 2 days ago',
      results: [
        { label: 'Transformative / Very Helpful', percentage: 74 },
        { label: 'Good, need more buses', percentage: 19 },
        { label: 'Neutral', percentage: 5 },
        { label: 'Unsatisfied', percentage: 2 }
      ]
    },
    {
      id: 2,
      title: 'Rythu Bharosa Direct Benefit Transfer Awareness in Rural Mandals',
      responses: 32150,
      timestamp: 'Active • 4 days ago',
      results: [
        { label: 'Received Fund Directly', percentage: 68 },
        { label: 'Verification Underway', percentage: 22 },
        { label: 'Applied Recently', percentage: 10 }
      ]
    }
  ]);

  // Cadre Tab
  const [cadreTier, setCadreTier] = useState('constituency');

  const filteredConstituencies = useMemo(() => {
    return ALL_TELANGANA_CONSTITUENCIES.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.district.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.incharge.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (assemblyFilter === 'winning') return c.status === 'WINNING';
      if (assemblyFilter === 'trailing') return c.status === 'TRAILING';
      return true;
    });
  }, [searchQuery, assemblyFilter]);

  const winningCount = useMemo(() => ALL_TELANGANA_CONSTITUENCIES.filter((c) => c.status === 'WINNING').length, []);
  const trailingCount = useMemo(() => ALL_TELANGANA_CONSTITUENCIES.filter((c) => c.status === 'TRAILING').length, []);

  const handleGenerateCampaign = () => {
    if (campaignPrompt.includes('Rythu') || campaignPrompt.includes('Loan')) {
      setCampaignGeneratedMsg('రైతు భరోసా ద్వారా ఎకరాకు ₹15,000 సాయం & ₹2 లక్షల రుణమాఫీ నేరుగా మీ ఖాతాల్లో జమ అవుతోంది. రైతు సంక్షేమమే ప్రజా ప్రభుత్వ ధ్యేయం!');
    } else if (campaignPrompt.includes('Indiramma') || campaignPrompt.includes('House')) {
      setCampaignGeneratedMsg('ఇందిరమ్మ ఇళ్ల పథకం కింద అర్హులైన ప్రతి నిరుపేద కుటుంబానికి ₹5 లక్షల గృహ నిర్మాణ సహాయం. మీ స్వంతింటి కలను నిజం చేస్తున్న కాంగ్రెస్ ప్రభుత్వం.');
    } else {
      setCampaignGeneratedMsg('నమస్కారం! కాంగ్రెస్ ప్రభుత్వం అమలు చేస్తున్న 6 గ్యారంటీలు ప్రతి గడపకూ చేరుతున్నాయి. ప్రజా పాలనలో భాగస్వాములు కండి!');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(campaignGeneratedMsg);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2000);
  };

  return (
    <div className="w-full h-screen overflow-hidden flex flex-col md:flex-row bg-[#F8FAFC] text-slate-900 font-sans antialiased" id="state-dashboard-root">
      {/* Sidebar Navigation: Fixed Full-Height matching Mandal / Booth benchmark */}
      <aside className="fixed inset-y-0 left-0 z-40 w-64 h-screen bg-slate-950 text-white flex flex-col justify-between border-r border-slate-900 p-5 shrink-0 select-none md:fixed" id="state-sidebar">
        <div className="space-y-5">
          {/* Logo / Header */}
          <div className="flex items-center gap-3 border-b border-slate-800/80 pb-4">
            <div className="w-11 h-11 bg-amber-400 rounded-full flex items-center justify-center text-slate-950 font-black text-base shadow-md shrink-0">
              INC
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black tracking-tight text-white truncate">
                {config.organisationName || 'Telangana Congress'}
              </h2>
              <span className="text-[10px] bg-slate-900 text-amber-300 font-extrabold uppercase px-2 py-0.5 rounded tracking-wide border border-amber-400/20">
                STATE INCHARGE
              </span>
            </div>
          </div>

          {/* Assigned Jurisdiction Card */}
          <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80 space-y-1">
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Assigned Jurisdiction</p>
            <h4 className="text-xs font-bold text-slate-100 truncate">
              Telangana State Command
            </h4>
            <div className="text-[10px] text-slate-400 flex flex-col gap-0.5 font-mono">
              <span>Scope: 119 ACs &bull; 17 LS Seats</span>
              <span>Total Voters: 33,517,327</span>
              <span>Operator: {session.userName || 'TPCC State Chief'}</span>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1 text-xs" id="state-sidebar-nav">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'constituency_list', label: 'Constituency List (119)', icon: Users },
              { id: 'parliament_list', label: 'Parliament List (17)', icon: Building2 },
              { id: 'zone_list', label: 'Zones List (5)', icon: Layers },
              { id: 'ground_reports', label: 'Ground Reports', icon: BarChart3 },
              { id: 'campaign', label: 'Start A Campaign', icon: Megaphone },
              { id: 'poll', label: 'Raise A Poll', icon: Vote },
              { id: 'cadre_network', label: 'Cadre Network', icon: Network },
              { id: 'ai_intel', label: 'AI Intelligence', icon: Bot },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as StateTabType);
                    setSelectedZone(null);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all text-left cursor-pointer ${
                    isActive
                      ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                      : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Sign Out */}
        <div className="pt-4 border-t border-slate-900 mt-auto">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold text-red-400 hover:bg-red-950/20 hover:text-red-300 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace with native scroll */}
      <main className="flex-1 h-screen overflow-y-auto overflow-x-hidden bg-[#F8FAFC] relative md:pl-64" id="main-workspace-section">
        {/* Tab Content */}
        <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full pb-28">
          {/* In-page Header Banner (White Card matching Mandal / Booth standard) */}
          <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm" id="state-header-bar">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] bg-yellow-400 text-slate-950 px-2 py-0.5 rounded font-black uppercase tracking-widest">
                  APEX STATE COMMAND
                </span>
                <h1 className="text-2xl font-black tracking-tight text-slate-900" id="state-title">
                  Statewide War Room &bull; Telangana 2024
                </h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-semibold">
                  <span className="text-slate-900">Jurisdiction: <strong className="font-extrabold">Telangana State (119 Segments)</strong></span>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-900">Total Voters: <strong className="font-extrabold text-slate-950">33,517,327</strong></span>
                  <span className="text-slate-300">|</span>
                  <span>Parliaments: <strong className="font-extrabold text-slate-950">17 LS Seats</strong></span>
                </div>
              </div>

              <div className="flex flex-col items-end shrink-0 bg-slate-50 border border-slate-100 p-3 rounded-lg text-right">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live State Network Active
                </div>
                <p className="text-[10px] text-gray-500 font-semibold uppercase mt-1">
                  {session.userName || 'TPCC Chief / State Incharge'}
                </p>
              </div>
            </div>
          </div>

          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fade-in" id="state-dashboard-view">
              {/* ELECTION FORECAST HERO BANNER */}
              <div className="relative bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white rounded-2xl p-6 md:p-8 shadow-md border border-slate-800" id="state-forecast-banner">
                <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_bottom_right,_var(--tw-gradient-stops))] from-yellow-400 via-transparent to-transparent"></div>
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                  <div className="space-y-2">
                    <span className="px-2 py-0.5 bg-yellow-400/20 text-yellow-400 text-[10px] font-black uppercase tracking-widest rounded border border-yellow-400/20">
                      STATEWIDE ELECTION FORECAST / PROJECTION
                    </span>
                    
                    <h2 className="text-3xl font-black tracking-tight" id="state-forecast-winner">
                      <span className="text-yellow-400">INC</span>{' '}
                      <span className="text-white">PROJECTED CLEAR MAJORITY</span>
                    </h2>
                    
                    <p className="text-lg font-bold text-gray-300">
                      Leading in <span className="text-yellow-400 text-xl font-extrabold">69 / 119</span> Assembly Seats • Statewide Vote Share <span className="text-emerald-400 font-black">41.2%</span>
                    </p>
                    
                    <p className="text-xs text-gray-400 font-medium">
                      Based on real-time aggregated telemetries across all 119 ACs &bull; Magic Figure: 60 Seats
                    </p>
                  </div>
                  
                  {/* Trophy Accent Graphic */}
                  <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 flex items-center justify-center shrink-0 shadow">
                    <Award className="w-12 h-12 text-yellow-400" />
                  </div>
                </div>
              </div>

              {/* TOP 4 TINTED KPI CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="state-top-cards">
                {/* Card 1: Total Voters */}
                <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-3">
                  <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Total Voters</p>
                  <h3 className="text-3xl font-black text-slate-950">33,517,327</h3>
                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                    <span>Coverage</span>
                    <span className="font-extrabold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Statewide Coverage 100%
                    </span>
                  </div>
                </div>

                {/* Card 2: Projected Wins */}
                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-3">
                  <p className="text-xs font-black text-amber-700 uppercase tracking-wider">Projected Wins (Seats)</p>
                  <h3 className="text-3xl font-black text-amber-600">
                    69 <span className="text-amber-800/60 text-lg font-bold">/ 119</span>
                  </h3>
                  <div className="pt-2 border-t border-amber-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                    <span>Magic Figure</span>
                    <span className="font-black text-amber-700">60 Seats</span>
                  </div>
                </div>

                {/* Card 3: Vote Share */}
                <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-3">
                  <p className="text-xs font-black text-purple-700 uppercase tracking-wider">Vote Share</p>
                  <h3 className="text-3xl font-black text-purple-600">41.2%</h3>
                  <div className="pt-2 border-t border-purple-200/60 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                    <span>Trend</span>
                    <span className="font-black text-purple-700">+2.4% vs Last Election</span>
                  </div>
                </div>

                {/* Card 4: Fake Votes */}
                <div className="bg-rose-50/50 border-2 border-rose-200 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-3">
                  <p className="text-xs font-black text-rose-700 uppercase tracking-wider">Fake Votes Identified</p>
                  <h3 className="text-3xl font-black text-rose-600 flex items-center gap-2">
                    73,427
                    <AlertTriangle className="text-rose-500 w-5 h-5" />
                  </h3>
                  <div className="pt-2 border-t border-rose-200/60 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                    <span>EC Complaints</span>
                    <span className="font-black text-rose-700">Flagged Statewide</span>
                  </div>
                </div>
              </div>

              {/* Row 2: Election Forecast & Party Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Election Forecast Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200/80 space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Trophy className="text-amber-500 w-5 h-5" />
                      <span>Election Forecast Breakdown</span>
                    </h3>
                    <span className="text-[11px] font-extrabold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                      69/119 Leading
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1.5">
                        <span className="text-slate-700">Assembly Seats (Magic Figure: 60)</span>
                        <span className="text-blue-600 font-extrabold">69/119</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200/60">
                        <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-500" style={{ width: '58%' }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1.5">
                        <span className="text-slate-700">Parliament Seats</span>
                        <span className="text-emerald-600 font-extrabold">10/17</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200/60">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all duration-500" style={{ width: '59%' }} />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-blue-50/70 rounded-xl border border-blue-200/60">
                      <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-1">PROJECTED CM</p>
                      <p className="text-lg font-black text-blue-950">INC Candidate</p>
                    </div>
                    <div className="text-center p-4 bg-emerald-50/70 rounded-xl border border-emerald-200/60">
                      <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">VOTE SHARE</p>
                      <p className="text-lg font-black text-emerald-950">42.5%</p>
                    </div>
                  </div>
                </div>

                {/* Party-wise Breakdown Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200/80 space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <BarChart3 className="text-slate-600 w-5 h-5" />
                      <span>Party-wise Breakdown</span>
                    </h3>
                    <span className="text-[11px] font-bold text-slate-400">Total: 119 Seats</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="p-4 rounded-xl bg-blue-50/80 border-2 border-blue-200 relative overflow-hidden">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-xs font-black text-blue-800 uppercase tracking-wide">INC (Congress)</p>
                        <span className="text-[10px] font-black bg-blue-600 text-white px-2 py-0.5 rounded-full">
                          58%
                        </span>
                      </div>
                      <p className="text-3xl font-black text-blue-950 mb-0.5">69</p>
                      <p className="text-[11px] text-blue-700 font-bold uppercase tracking-wider">Leading</p>
                    </div>

                    <div className="p-4 rounded-xl bg-pink-50/70 border-2 border-pink-200 relative overflow-hidden">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-xs font-black text-pink-800 uppercase tracking-wide">BRS</p>
                        <span className="text-[10px] font-bold bg-white text-pink-700 border border-pink-200 px-2 py-0.5 rounded-full">
                          29%
                        </span>
                      </div>
                      <p className="text-3xl font-black text-pink-950 mb-0.5">35</p>
                      <p className="text-[11px] text-pink-700 font-bold uppercase tracking-wider">Opposition</p>
                    </div>

                    <div className="p-4 rounded-xl bg-orange-50/70 border-2 border-orange-200 relative overflow-hidden">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-xs font-black text-orange-800 uppercase tracking-wide">BJP</p>
                        <span className="text-[10px] font-bold bg-white text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full">
                          7%
                        </span>
                      </div>
                      <p className="text-3xl font-black text-orange-950 mb-0.5">8</p>
                      <p className="text-[11px] text-orange-700 font-bold uppercase tracking-wider">Trailing</p>
                    </div>

                    <div className="p-4 rounded-xl bg-emerald-50/70 border-2 border-emerald-200 relative overflow-hidden">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-xs font-black text-emerald-800 uppercase tracking-wide">MIM</p>
                        <span className="text-[10px] font-bold bg-white text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                          6%
                        </span>
                      </div>
                      <p className="text-3xl font-black text-emerald-950 mb-0.5">7</p>
                      <p className="text-[11px] text-emerald-700 font-bold uppercase tracking-wider">Stable</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 3: Statewide Vote Share & HQ Command Center */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Statewide Vote Share Donut */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-xs border border-slate-200 flex flex-col justify-between">
                  <h3 className="text-lg font-bold mb-4 text-slate-900">Statewide Vote Share</h3>
                  <div className="h-64 flex flex-col sm:flex-row items-center justify-center gap-8">
                    <div className="relative w-48 h-48 flex items-center justify-center">
                      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                        {/* INC: 42% */}
                        <circle cx="18" cy="18" r="14" fill="transparent" stroke="#2563eb" strokeWidth="4.5" strokeDasharray="42 58" strokeDashoffset="0" />
                        {/* BRS: 34% */}
                        <circle cx="18" cy="18" r="14" fill="transparent" stroke="#ec4899" strokeWidth="4.5" strokeDasharray="34 66" strokeDashoffset="-42" />
                        {/* BJP: 14% */}
                        <circle cx="18" cy="18" r="14" fill="transparent" stroke="#f97316" strokeWidth="4.5" strokeDasharray="14 86" strokeDashoffset="-76" />
                        {/* MIM: 4% */}
                        <circle cx="18" cy="18" r="14" fill="transparent" stroke="#22c55e" strokeWidth="4.5" strokeDasharray="4 96" strokeDashoffset="-90" />
                        {/* Neutral: 6% */}
                        <circle cx="18" cy="18" r="14" fill="transparent" stroke="#94a3b8" strokeWidth="4.5" strokeDasharray="6 94" strokeDashoffset="-94" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-black text-slate-900">41.2%</span>
                        <span className="text-[10px] font-bold text-blue-600 uppercase">INC Lead</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-semibold text-slate-700">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-blue-600" />
                        <span>INC (41.2%)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-pink-500" />
                        <span>BRS (34.1%)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-orange-500" />
                        <span>BJP (14.0%)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-green-500" />
                        <span>MIM (4.2%)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-slate-400" />
                        <span>Neutral (6.5%)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* HQ Command Center */}
                <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg border border-slate-800 overflow-hidden flex flex-col">
                  <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Radio className="text-green-500 animate-pulse w-5 h-5" />
                      <span>HQ Command Center</span>
                    </h3>
                  </div>

                  <div className="flex-1 space-y-3 overflow-y-auto">
                    <div className="flex items-start gap-3 text-sm bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                      <div className="mt-1 w-2 h-2 rounded-full bg-red-500 animate-ping" />
                      <div>
                        <p className="font-bold text-red-400">Fake Vote Alert</p>
                        <p className="text-xs text-slate-300">Constituency: Maheshwaram</p>
                        <p className="text-xs text-slate-400 mt-1">Booth 112A marked 5 voters as FAKE.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 text-sm bg-blue-500/10 p-3 rounded-xl border border-blue-500/20">
                      <div className="mt-1 w-2 h-2 rounded-full bg-blue-400" />
                      <div>
                        <p className="font-bold text-blue-400">Swing Seat Alert</p>
                        <p className="text-xs text-slate-300">Constituency: Kodangal</p>
                        <p className="text-xs text-slate-400 mt-1">Turnout projection jumped +4.8% post Rythu Bharosa.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 4: Assembly Seats Performance */}
              <div className="mt-8 space-y-6 border-t border-slate-200 pt-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Assembly Seats Performance</h3>
                    <p className="text-sm text-slate-500">
                      Track and filter active leading and trailing assembly seats under your oversight.
                    </p>
                  </div>

                  <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-full sm:w-auto self-start sm:self-auto shadow-xs">
                    <button
                      onClick={() => setAssemblyFilter('all')}
                      className={`flex-1 sm:flex-initial px-4 py-2 rounded-md text-xs font-bold transition-all ${
                        assemblyFilter === 'all'
                          ? 'bg-white text-slate-800 shadow-xs border border-slate-200/50'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All ({ALL_TELANGANA_CONSTITUENCIES.length})
                    </button>
                    <button
                      onClick={() => setAssemblyFilter('winning')}
                      className={`flex-1 sm:flex-initial px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        assemblyFilter === 'winning' ? 'bg-blue-600 text-white shadow-xs' : 'text-blue-600 hover:bg-blue-50'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${assemblyFilter === 'winning' ? 'bg-white' : 'bg-blue-600'}`} />
                      Winning ({winningCount})
                    </button>
                    <button
                      onClick={() => setAssemblyFilter('trailing')}
                      className={`flex-1 sm:flex-initial px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        assemblyFilter === 'trailing' ? 'bg-orange-600 text-white shadow-xs' : 'text-orange-600 hover:bg-orange-50'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${assemblyFilter === 'trailing' ? 'bg-white' : 'bg-orange-600'}`} />
                      Trailing ({trailingCount})
                    </button>
                  </div>
                </div>

                {/* Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredConstituencies.map((c, idx) => {
                    const isWinning = c.status === 'WINNING';
                    const totalVotes = c.incVotes + c.brsVotes + c.bjpVotes + c.mimVotes;
                    return (
                      <div
                        key={c.id}
                        className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden hover:shadow-md transition-all relative"
                      >
                        <div className="absolute top-0 left-0 bg-slate-100 text-slate-500 text-[10px] font-bold px-3 py-1.5 border-b border-r border-slate-200 rounded-br-lg z-10">
                          #{idx + 1}
                        </div>

                        <div className="p-6 pb-4 pt-8">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="text-xl font-bold text-slate-900">{c.name}</h3>
                              <div className="text-slate-500 text-sm mt-0.5">Incharge: {c.incharge}</div>
                            </div>
                            <div className={`text-right border rounded-lg px-3 py-1.5 ${
                              isWinning ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-100'
                            }`}>
                              <p className={`text-[10px] font-bold uppercase tracking-wide ${
                                isWinning ? 'text-green-600' : 'text-slate-500'
                              }`}>
                                {isWinning ? 'LEADING' : 'TRAILING'}
                              </p>
                              <p className={`text-lg font-bold ${isWinning ? 'text-green-700' : 'text-slate-700'}`}>
                                {c.margin}
                              </p>
                            </div>
                          </div>

                          <div className="flex justify-between items-center mb-5">
                            <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
                              <Users size={16} />
                              <span>TOTAL VOTERS</span>
                            </div>
                            <div className="text-xl font-bold text-slate-900">
                              {c.voters.toLocaleString()}
                            </div>
                          </div>

                          <div className="mb-2">
                            <p className="text-xs text-slate-500 font-medium mb-1.5">Vote Share</p>
                            <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-slate-100">
                              <div style={{ width: `${(c.incVotes / totalVotes) * 100}%` }} className="bg-blue-600" />
                              <div style={{ width: `${(c.brsVotes / totalVotes) * 100}%` }} className="bg-pink-500" />
                              <div style={{ width: `${(c.bjpVotes / totalVotes) * 100}%` }} className="bg-orange-500" />
                              <div style={{ width: `${(c.mimVotes / totalVotes) * 100}%` }} className="bg-green-500" />
                            </div>
                          </div>

                          <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-50">
                            <div className="text-center p-1.5 rounded bg-blue-50">
                              <p className="text-[10px] font-bold text-blue-600">INC</p>
                              <p className="text-sm font-bold text-blue-700">{(c.incVotes / 1000).toFixed(1)}k</p>
                            </div>
                            <div className="text-center p-1.5 rounded bg-pink-50">
                              <p className="text-[10px] font-bold text-pink-600">BRS</p>
                              <p className="text-sm font-bold text-pink-700">{(c.brsVotes / 1000).toFixed(1)}k</p>
                            </div>
                            <div className="text-center p-1.5 rounded bg-orange-50">
                              <p className="text-[10px] font-bold text-orange-600">BJP</p>
                              <p className="text-sm font-bold text-orange-700">{(c.bjpVotes / 1000).toFixed(1)}k</p>
                            </div>
                            <div className="text-center p-1.5 rounded bg-green-50">
                              <p className="text-[10px] font-bold text-green-600">MIM</p>
                              <p className="text-sm font-bold text-green-700">{(c.mimVotes / 1000).toFixed(1)}k</p>
                            </div>
                          </div>
                        </div>

                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                            <CheckCircle2 size={14} className="text-blue-500" />
                            <span>100% Verified</span>
                          </div>
                          <button
                            onClick={() => setViewingMandalConstituency(c.name)}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <span>View Mandals</span>
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CONSTITUENCY LIST (119) */}
          {activeTab === 'constituency_list' && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Constituency List (119)</h2>
                  <p className="text-slate-500 text-sm">Real-time status across all 119 Assembly segments</p>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search constituency or incharge..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 w-64 shadow-xs"
                  />
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-mono text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="p-3.5"># AC</th>
                      <th className="p-3.5">Constituency Name</th>
                      <th className="p-3.5">District</th>
                      <th className="p-3.5">Incharge</th>
                      <th className="p-3.5 text-right">Voters</th>
                      <th className="p-3.5 text-center">Status</th>
                      <th className="p-3.5 text-right">Margin</th>
                      <th className="p-3.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredConstituencies.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="p-3.5 font-mono text-slate-400">#{c.id}</td>
                        <td className="p-3.5 font-extrabold text-slate-900">{c.name}</td>
                        <td className="p-3.5 text-slate-500">{c.district}</td>
                        <td className="p-3.5 text-slate-700">{c.incharge}</td>
                        <td className="p-3.5 text-right font-mono text-slate-800">{c.voters.toLocaleString()}</td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            c.status === 'WINNING'
                              ? 'bg-green-100 text-green-700 border border-green-200'
                              : 'bg-red-100 text-red-700 border border-red-200'
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-black text-slate-900">{c.margin}</td>
                        <td className="p-3.5 text-center">
                          <a
                            href={`tel:${c.phone}`}
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>Call</span>
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: PARLIAMENT LIST (17) */}
          {activeTab === 'parliament_list' && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Parliament List (17)</h2>
                <p className="text-slate-500 text-sm">Statewide Lok Sabha seats and Parliamentary Incharge teams</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {TELANGANA_17_PARLIAMENTS.map((p) => (
                  <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono text-slate-400">Seat #{p.id}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        p.status === 'WINNING' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {p.status}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{p.name}</h3>
                      <p className="text-xs text-blue-600 font-bold">Candidate: {p.candidate}</p>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1">
                      <div className="flex justify-between text-slate-600">
                        <span>Voters:</span> <strong className="text-slate-900">{p.voters.toLocaleString()}</strong>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Lead Margin:</span> <strong className="text-slate-900">{p.margin}</strong>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Incharge:</span> <span className="text-slate-800 font-semibold">{p.incharge}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-slate-500 font-mono">{p.phone}</span>
                      <a
                        href={`tel:${p.phone}`}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition"
                      >
                        <Phone className="w-3 h-3" />
                        <span>Call</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: ZONES LIST (5) */}
          {activeTab === 'zone_list' && (
            <div className="space-y-5 animate-fade-in">
              {selectedZone ? (
                // Zone Coordinator View drilldown
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedZone(null)}
                      className="p-2 bg-white rounded-full border border-slate-200 hover:bg-slate-100 text-slate-700 transition cursor-pointer"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">{selectedZone}</h2>
                      <p className="text-slate-500 text-sm">Zone Coordinator View</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-5 rounded-xl border border-slate-200">
                      <p className="text-xs text-slate-500 font-bold uppercase">Parliaments in Zone</p>
                      <p className="text-2xl font-black text-slate-900 mt-1">3 LS Seats</p>
                    </div>
                    <div className="bg-white p-5 rounded-xl border border-slate-200">
                      <p className="text-xs text-slate-500 font-bold uppercase">Assemblies in Zone</p>
                      <p className="text-2xl font-black text-slate-900 mt-1">21 AC Seats</p>
                    </div>
                    <div className="bg-white p-5 rounded-xl border border-slate-200">
                      <p className="text-xs text-slate-500 font-bold uppercase">Projected Wins</p>
                      <p className="text-2xl font-black text-green-600 mt-1">21 / 21 (100%)</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Zones List (5)</h2>
                  <p className="text-slate-500 text-sm">Regional administrative coordination across Telangana</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                    {TELANGANA_5_ZONES.map((z) => (
                      <div key={z.name} className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-bold text-slate-900">{z.name}</h3>
                          <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-md">
                            {z.voteShare} Projected
                          </span>
                        </div>

                        <div className="text-xs text-slate-500">
                          <strong>Parliaments:</strong> {z.parliaments.join(', ')}
                        </div>

                        <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                          <div>
                            <div className="text-[10px] text-slate-500 uppercase">Assemblies</div>
                            <div className="text-base font-bold text-slate-900 mt-0.5">{z.assembliesCount}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-500 uppercase">Projected Wins</div>
                            <div className="text-base font-bold text-blue-600 mt-0.5">{z.projectedWins}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-500 uppercase">Total Voters</div>
                            <div className="text-base font-bold text-slate-900 mt-0.5">{z.voters}</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <div className="text-xs text-slate-600">
                            Coordinator: <strong>{z.coordinator}</strong>
                          </div>
                          <button
                            onClick={() => setSelectedZone(z.name)}
                            className="px-3.5 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            Explore Zone &rarr;
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: GROUND REPORTS */}
          {activeTab === 'ground_reports' && (
            <div className="space-y-8 animate-fade-in pb-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <BarChart3 className="text-blue-600" />
                    <span>War Room Intelligence</span>
                  </h2>
                  <p className="text-slate-500 text-sm">Statewide Ground Reports &amp; Strategic Analysis</p>
                </div>
                <button
                  onClick={() => window.print()}
                  className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 transition cursor-pointer shadow-xs text-xs"
                >
                  <Download size={16} />
                  <span>Export Report</span>
                </button>
              </div>

              {/* 3 KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
                  <div className="relative z-10">
                    <p className="text-blue-100 text-xs font-bold uppercase tracking-wider mb-2">Assembly Seat Projection</p>
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-5xl font-black">69</h3>
                      <span className="text-2xl font-medium text-blue-200">/ 119</span>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <span className="bg-white/20 px-2 py-1 rounded text-xs font-bold">Majority Reached</span>
                      <span className="text-xs text-blue-100">+9 seats buffer</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs">
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Parliament Strike Rate</p>
                  <div>
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-3xl font-bold text-slate-800">11 <span className="text-slate-400 text-base font-normal">/ 17</span></span>
                      <span className="text-green-600 font-bold text-sm">Winning</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3">
                      <div className="bg-blue-600 h-3 rounded-full" style={{ width: '65%' }} />
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-blue-50 p-2 rounded text-blue-700 font-bold">INC: 11</div>
                    <div className="bg-pink-50 p-2 rounded text-pink-700 font-bold">BRS: 3</div>
                    <div className="bg-orange-50 p-2 rounded text-orange-700 font-bold">BJP: 3</div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Flame size={14} className="text-orange-500" />
                      Critical Swing Seats
                    </p>
                    <h3 className="text-3xl font-bold text-slate-800">6</h3>
                    <p className="text-xs text-slate-500 mt-1">Margins under 5% requiring immediate intervention.</p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    {['Peddapalli', 'Bhongir', 'Chevella'].map((s) => (
                      <span key={s} className="text-[10px] bg-red-50 text-red-700 border border-red-100 px-2 py-1 rounded font-bold">
                        {s}
                      </span>
                    ))}
                    <span className="text-[10px] text-slate-400 px-1 py-1">+3 more</span>
                  </div>
                </div>
              </div>

              {/* Safe Seats, Battleground, Difficult */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 rounded-xl p-5 border border-green-100">
                  <h4 className="font-bold text-green-800 mb-2 flex items-center gap-2 text-sm">
                    <CheckCircle2 size={16} /> Safe Seats (Stronghold)
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {['Nalgonda', 'Khammam', 'Warangal', 'Mahabubabad', 'Nagarkurnool'].map((seat) => (
                      <span key={seat} className="bg-white text-green-700 text-xs px-2.5 py-1 rounded border border-green-200 font-medium shadow-xs">
                        {seat}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-orange-50 rounded-xl p-5 border border-orange-100">
                  <h4 className="font-bold text-orange-800 mb-2 flex items-center gap-2 text-sm">
                    <Flame size={16} /> Battleground (Fight)
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {['Peddapalli', 'Bhongir', 'Chevella', 'Mahabubnagar', 'Nizamabad'].map((seat) => (
                      <span key={seat} className="bg-white text-orange-700 text-xs px-2.5 py-1 rounded border border-orange-200 font-medium shadow-xs">
                        {seat}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-red-50 rounded-xl p-5 border border-red-100">
                  <h4 className="font-bold text-red-800 mb-2 flex items-center gap-2 text-sm">
                    <AlertTriangle size={16} /> Difficult (Trailing)
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {['Secunderabad', 'Malkajgiri', 'Karimnagar', 'Adilabad', 'Hyderabad'].map((seat) => (
                      <span key={seat} className="bg-white text-red-700 text-xs px-2.5 py-1 rounded border border-red-200 font-medium shadow-xs">
                        {seat}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: START A CAMPAIGN */}
          {activeTab === 'campaign' && (
            <div className="space-y-6 animate-fade-in pb-10">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg text-white">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">AI Campaign Assistant</h2>
                  <p className="text-slate-500 text-sm">Draft WhatsApp &amp; SMS messages instantly using Gemini AI.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Form */}
                <div className="bg-white p-6 rounded-xl shadow-xs border border-slate-200 space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Campaign Focus / Scheme</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        'Mahalakshmi Free Bus Travel',
                        'Rythu Bharosa Support',
                        'Indiramma Indlu Housing',
                        '2 Lakh Farm Loan Waiver',
                        'Youth Job Calendar'
                      ].map((scheme) => (
                        <button
                          key={scheme}
                          onClick={() => setCampaignPrompt(scheme)}
                          className={`text-xs px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                            campaignPrompt === scheme
                              ? 'bg-blue-50 text-blue-700 border-blue-200 font-bold'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {scheme}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Campaign Objective</label>
                    <textarea
                      rows={3}
                      value={campaignPrompt}
                      onChange={(e) => setCampaignPrompt(e.target.value)}
                      placeholder="Describe target voters, key messaging points, and call to action..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Language</label>
                      <select
                        value={campaignLang}
                        onChange={(e) => setCampaignLang(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                      >
                        <option value="Telugu">Telugu</option>
                        <option value="English">English</option>
                        <option value="Urdu">Urdu</option>
                        <option value="Hindi">Hindi</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Tone</label>
                      <select
                        value={campaignTone}
                        onChange={(e) => setCampaignTone(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                      >
                        <option value="Inspirational">Inspirational</option>
                        <option value="Urgent">Urgent</option>
                        <option value="Factual">Factual</option>
                        <option value="Aggressive">Aggressive</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateCampaign}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-md transition cursor-pointer text-xs flex items-center justify-center gap-2"
                  >
                    <Sparkles size={16} />
                    <span>Generate AI Broadcast Message</span>
                  </button>
                </div>

                {/* Live Preview */}
                <div className="bg-white p-6 rounded-xl shadow-xs border border-slate-200 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-slate-900 text-sm">Generated Message Preview</h3>
                      {copiedToast && (
                        <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded">
                          Copied to Clipboard!
                        </span>
                      )}
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 text-xs leading-relaxed font-sans">
                      {campaignGeneratedMsg}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleCopy}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Copy size={16} />
                      <span>Copy Message</span>
                    </button>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(campaignGeneratedMsg)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition text-center"
                    >
                      <Share2 size={16} />
                      <span>Share on WhatsApp</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: RAISE A POLL */}
          {activeTab === 'poll' && (
            <div className="space-y-8 animate-fade-in pb-10">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl shadow-lg text-white">
                  <Vote size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Smart Poll Command Center</h2>
                  <p className="text-slate-500 text-sm">Gauge ground sentiment instantly using AI-driven polls.</p>
                </div>
              </div>

              {/* Create Poll Card */}
              <div className="bg-white p-6 rounded-xl shadow-xs border border-slate-200 space-y-4">
                <h3 className="font-bold text-slate-900 text-sm">AI Poll Architect</h3>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Poll Topic / Question</label>
                  <input
                    type="text"
                    value={pollTopic}
                    onChange={(e) => setPollTopic(e.target.value)}
                    placeholder="e.g. Rate your satisfaction with the Free RTC Bus Travel implementation..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Target Audience</label>
                    <select
                      value={pollTarget}
                      onChange={(e) => setPollTarget(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                    >
                      <option value="All Cadre">All Cadre</option>
                      <option value="Mandal Presidents">Mandal Presidents</option>
                      <option value="Booth Incharges">Booth Incharges</option>
                      <option value="Indiramma Committee">Indiramma Committee (100-Voters)</option>
                      <option value="Women Cadre">Women Cadre</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (!pollTopic.trim()) return;
                    setActivePolls([
                      {
                        id: Date.now(),
                        title: pollTopic,
                        responses: 0,
                        timestamp: 'Just launched',
                        results: pollOptions.map((opt) => ({ label: opt, percentage: 0 }))
                      },
                      ...activePolls
                    ]);
                    setPollTopic('');
                  }}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Deploy Poll Statewide
                </button>
              </div>

              {/* Active Polls */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-900">Active Live Polls</h3>
                {activePolls.map((poll) => (
                  <div key={poll.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-slate-900 text-sm">{poll.title}</h4>
                      <span className="text-xs font-mono text-slate-500">{poll.timestamp}</span>
                    </div>

                    <div className="space-y-2.5">
                      {poll.results.map((r, i) => (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-xs font-medium text-slate-700">
                            <span>{r.label}</span>
                            <span className="font-bold text-slate-900">{r.percentage}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                            <div className="h-full bg-blue-600 rounded-full" style={{ width: `${r.percentage}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="text-xs text-slate-500 pt-2 border-t border-slate-100">
                      Total Responses: <strong>{poll.responses.toLocaleString()}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 8: CADRE NETWORK */}
          {activeTab === 'cadre_network' && (
            <div className="space-y-6 animate-fade-in pb-10">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Statewide Cadre Network</h2>
                <p className="text-slate-500 text-sm">Total Cadre Strength: 395,437 across 8 tiers</p>
              </div>

              {/* Hierarchy Tiers Bar */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 text-xs font-bold no-scrollbar">
                {[
                  { id: 'state', label: 'State (1)' },
                  { id: 'zone', label: 'Zone Incharges (5)' },
                  { id: 'parliament', label: 'Parliament (17)' },
                  { id: 'constituency', label: 'Constituency (119)' },
                  { id: 'mandal', label: 'Mandal (595)' },
                  { id: 'village', label: 'Village (12,700)' },
                  { id: 'booth', label: 'Booth (32,000)' },
                  { id: 'voter', label: '100 Voter Inc (350,000)' }
                ].map((tier) => (
                  <button
                    key={tier.id}
                    onClick={() => setCadreTier(tier.id)}
                    className={`px-4 py-2 rounded-xl transition whitespace-nowrap cursor-pointer ${
                      cadreTier === tier.id
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ALL_TELANGANA_CONSTITUENCIES.slice(0, 9).map((c) => (
                  <div key={c.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-bold uppercase">
                        {cadreTier} LEVEL
                      </span>
                      <span className="text-xs text-green-600 font-bold flex items-center gap-1">
                        <CheckCircle2 size={12} /> Active
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{c.incharge}</h4>
                      <p className="text-xs text-slate-500">{c.name} Constituency Jurisdiction</p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-xs font-mono text-slate-600">{c.phone}</span>
                      <div className="flex gap-1.5">
                        <a href={`tel:${c.phone}`} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                          <Phone size={14} />
                        </a>
                        <a
                          href={`https://wa.me/${c.phone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100"
                        >
                          <MessageSquare size={14} />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 9: AI INTEL */}
          {activeTab === 'ai_intel' && (
            <div className="p-2 animate-fade-in">
              <AIStrategicIntelligenceCenter session={session} />
            </div>
          )}
        </div>

        {/* Modal for View Mandals */}
        {viewingMandalConstituency && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-base">{viewingMandalConstituency} &bull; Mandals Breakdown</h3>
                <button
                  onClick={() => setViewingMandalConstituency(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-lg"
                >
                  &times;
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Mandals under {viewingMandalConstituency} assembly segment reporting active booth telemetry.
              </p>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {['Mandal 1 (Urban)', 'Mandal 2 (Rural North)', 'Mandal 3 (South)', 'Mandal 4 (Central)'].map((m, i) => (
                  <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800">{m}</span>
                    <span className="text-green-600 font-bold">Winning (+18%)</span>
                  </div>
                ))}
              </div>

              <div className="pt-2 text-right">
                <button
                  onClick={() => setViewingMandalConstituency(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
