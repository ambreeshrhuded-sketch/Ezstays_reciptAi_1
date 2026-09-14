export interface SampleReceiptMeta {
  id: string;
  title: string;
  description: string;
  category: string;
  badge: string;
  fileName: string;
  expectedData: {
    hostelName: string;
    studentName: string;
    studentId: string;
    amount: number;
    receiptNo: string;
    roomBed: string;
    phone?: string;
    fatherName?: string;
    fatherPhone?: string;
    college?: string;
    course?: string;
    year?: string;
    address?: string;
    roomType?: string;
    totalFee?: number;
    balanceAmount?: number;
    amountInWords?: string;
    cashier?: string;
    date?: string;
    paymentMode?: string;
    refNo?: string;
    bankName?: string;
    installmentNo?: string;
  };
}

export const SAMPLE_RECEIPTS_CATALOG: SampleReceiptMeta[] = [
  {
    id: 'sample-nishant-singh',
    title: 'EZ Stays - Nishant Singh (Benchmark Case)',
    description: 'Hostel receipt EZ-25-CB-02-062 for Nishant Singh, Amount ₹75,000 via UPI UTR 519589142019 on 14-07-2025.',
    category: 'Benchmark / Exact Match',
    badge: '★ Benchmark Case',
    fileName: 'EZ-25-CB-02-062_Nishant_Singh.jpeg',
    expectedData: {
      hostelName: 'CB-02 Campus',
      studentName: 'Nishant Singh',
      studentId: 'STU-25-062',
      amount: 75000,
      receiptNo: 'EZ-25-CB-02-062',
      roomBed: 'Room 201',
      date: '14-07-2025',
      paymentMode: 'UPI',
      refNo: '519589142019',
      bankName: 'Axis Bank',
      installmentNo: '1',
    },
  },
  {
    id: 'sample-mulahi-kumar',
    title: 'EZ Stays - Mulahi Kumar (PhonePe Benchmark)',
    description: 'Hostel receipt EZ-25-CB-067 for Mulahi Kumar, Amount ₹76,000 via PhonePe UPI UTR 061139618481 on 15-07-2025.',
    category: 'Benchmark / Exact Match',
    badge: '★ PhonePe Match',
    fileName: 'EZ-25-CB-067_Mulahi_Kumar.jpeg',
    expectedData: {
      hostelName: 'CB-02 Campus',
      studentName: 'Mulahi Kumar',
      studentId: 'STU-25-067',
      amount: 76000,
      receiptNo: 'EZ-25-CB-067',
      roomBed: 'Room 205',
      date: '15-07-2025',
      paymentMode: 'PhonePe',
      refNo: '061139618481',
      bankName: 'PhonePe UPI',
      installmentNo: '1',
    },
  },
  {
    id: 'sample-ezstays-basecamp',
    title: 'EZ Stays - Base Camp (Gold Standard Reference)',
    description: 'Real EZ Stays physical slip: Handwritten "Base Camp" above logo, "EZ-26-RG" prefix + "855" handwritten, Roman "I" installment, PhonePe mode, Rupees in words.',
    category: 'Physical Slip / Real Sample',
    badge: '★ Reference Sample',
    fileName: 'EZ_Stays_BaseCamp_855_Diwakar_Ray.jpeg',
    expectedData: {
      hostelName: 'Base Camp',
      studentName: 'Diwakar Ray',
      studentId: '',
      amount: 10000,
      receiptNo: 'EZ-26-RG-855',
      roomBed: '',
      phone: '9140536862',
      fatherName: 'Mukund Lal Kushwaha',
      fatherPhone: '9956880842',
      college: 'Bennett',
      course: 'B.Tech',
      year: '1st',
      address: 'Ghazipur (U.P)',
      roomType: '3 & 6 beds A.C.',
      totalFee: 205000,
      balanceAmount: 195000,
      amountInWords: 'Ten thousand Rupees Only',
      date: '11-08-2026',
      paymentMode: 'PhonePe',
      refNo: '30054851268',
      bankName: 'IDFC',
      installmentNo: '1',
    },
  },
  {
    id: 'sample-challan-01',
    title: 'University Hostel Formal Challan',
    description: 'Official A4 format fee challan with student ID, college, course, room allocation, UTR transaction ref, and official stamp.',
    category: 'Computer Generated',
    badge: 'Challan Format',
    fileName: 'Hostel_Challan_Rahul_Kumar_2026.png',
    expectedData: {
      hostelName: 'Tagore Block A Hostel',
      studentName: 'Rahul Kumar',
      studentId: 'STU-2026-0842',
      amount: 45000,
      receiptNo: 'REC/2026/0942',
      roomBed: 'Room 204 / Bed 2',
      phone: '9876543210',
      college: 'National Institute of Technology',
      course: 'B.Tech (Computer Science)',
      date: '18-08-2026',
      paymentMode: 'UPI',
      refNo: 'UTR984729103948',
    },
  },
  {
    id: 'sample-thermal-02',
    title: 'Thermal POS Counter Fee Receipt',
    description: 'Narrow thermal slip with dashed lines, cashier name (Knocked By), UPI reference, student phone number.',
    category: 'POS Slip',
    badge: 'Thermal Receipt',
    fileName: 'Counter_POS_Slip_Priya_Sharma.png',
    expectedData: {
      hostelName: 'Sarojini Girls Hostel',
      studentName: 'Priya Sharma',
      studentId: 'SGH-8819',
      amount: 28000,
      receiptNo: 'POS-77412',
      roomBed: 'B-302 (Bed 1)',
      phone: '9823456789',
      college: 'Apex College',
      course: 'BCA',
      date: '19-08-2026',
      paymentMode: 'UPI',
      refNo: 'UPI/729103847291',
    },
  },
  {
    id: 'sample-admission-03',
    title: 'Annual Admission Slip with Discount & Stamp',
    description: 'Admission voucher showing Father details, discount deduction, Yearly mode, and circular verification seal.',
    category: 'Admission Voucher',
    badge: 'Stamped Slip',
    fileName: 'Admission_Fee_Voucher_Ankit_Verma.png',
    expectedData: {
      hostelName: 'Kalam Boys Residence',
      studentName: 'Ankit Verma',
      studentId: 'KBR-2026-110',
      amount: 75000,
      receiptNo: 'KBR-ADM-551',
      roomBed: 'Room 108 / Bed 3',
      phone: '9811992288',
      fatherName: 'Ramesh Verma',
      fatherPhone: '9811993344',
      college: 'City University Law School',
      course: 'B.A. LL.B',
      date: '20-08-2026',
      paymentMode: 'Bank Transfer / NEFT',
      refNo: 'NEFT8392019482',
    },
  },
  {
    id: 'sample-quarterly-04',
    title: 'Shivaji Hostel Quarterly Rent Receipt',
    description: 'Quarterly boarding & mess fee receipt with room assignment, semester info, and cash counter endorsement.',
    category: 'Quarterly Voucher',
    badge: 'Quarterly Slip',
    fileName: 'Shivaji_Hostel_Quarterly_Fee_Rohan_Gupta.png',
    expectedData: {
      hostelName: 'Shivaji Heritage Hostel',
      studentName: 'Rohan Gupta',
      studentId: 'SHH-2026-449',
      amount: 32000,
      receiptNo: 'SHH-Q2-1082',
      roomBed: 'Room 312 / Bed 1',
      phone: '9845012345',
      fatherName: 'Sunil Gupta',
      fatherPhone: '9845098765',
      college: 'Global Institute of Technology',
      course: 'B.Sc IT',
      date: '22-08-2026',
      paymentMode: 'Google Pay / UPI',
      refNo: 'UPI/220819283746',
      installmentNo: '2',
    },
  },
];

export function generateSampleReceiptImage(sampleId: string): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  if (sampleId === 'sample-ezstays-basecamp') {
    // Exact EZ Stays Physical Receipt Slip (900x560)
    canvas.width = 900;
    canvas.height = 560;

    // Realistic slip paper background
    ctx.fillStyle = '#FEFCF6';
    ctx.fillRect(0, 0, 900, 560);

    // Subtle paper shadow and border
    ctx.strokeStyle = '#D6D3C7';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(15, 15, 870, 530);

    // 1. TOP HEADER: Handwritten Property Name "Base Camp" ABOVE the logo
    ctx.font = 'italic bold 18px cursive, sans-serif';
    ctx.fillStyle = '#1E3A8A'; // Blue handwriting ink
    ctx.textAlign = 'center';
    ctx.fillText('Base Camp', 450, 42);

    // 2. Printed Brand: "ez stays"
    ctx.font = '900 28px sans-serif';
    ctx.fillStyle = '#C026D3'; // Vibrant magenta / purple logo brand
    ctx.fillText('ez stays', 450, 76);

    // Small company details
    ctx.font = '9px sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText('Regd. Off.: C-63, Basment, Panchsheel Enclave, New Delhi - 110017', 450, 94);
    ctx.fillText('Phone No. +91-9643003748 | +91-9000 699 900 | info@ezstays.in', 450, 108);

    // Title: RECEIPT
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = '#0F172A';
    ctx.fillText('RECEIPT', 450, 132);

    // 3. UPPER RIGHT: Printed Prefix "EZ-26-RG" and Handwritten Number "855"
    ctx.textAlign = 'left';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('Receipt No.', 680, 52);
    
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#1E293B';
    ctx.fillText('EZ-26-RG', 680, 68);

    // Handwritten number 855
    ctx.font = 'italic bold 20px cursive, sans-serif';
    ctx.fillStyle = '#1E3A8A';
    ctx.fillText('855', 770, 72);

    // Date at top: Date: 11/08/26
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('Date: ........................', 680, 105);
    ctx.font = 'italic bold 13px cursive, sans-serif';
    ctx.fillStyle = '#1E3A8A';
    ctx.fillText('11/08/26', 720, 103);

    // 4. INSTALLMENT / REF / ID LINE
    ctx.textAlign = 'left';
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('Installment No. ........................ Ref. .................. ID ..............................', 45, 160);
    
    // Handwritten "I" for installment, "PR" for Ref
    ctx.font = 'italic bold 15px cursive, sans-serif';
    ctx.fillStyle = '#1E3A8A';
    ctx.fillText('I', 150, 158);
    ctx.fillText('PR', 320, 158);

    // Helper for dotted lines and handwritten values
    const drawHandwrittenRow = (
      label: string,
      handwrittenVal: string,
      y: number,
      secondLabel?: string,
      secondVal?: string
    ) => {
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#334155';
      ctx.fillText(label, 45, y);

      // Dots guide line
      ctx.strokeStyle = '#CBD5E1';
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(45 + ctx.measureText(label).width + 5, y + 2);
      ctx.lineTo(secondLabel ? 450 : 850, y + 2);
      ctx.stroke();

      // Handwritten ink
      ctx.font = 'italic bold 14px cursive, sans-serif';
      ctx.fillStyle = '#1E3A8A';
      ctx.fillText(handwrittenVal, 45 + ctx.measureText(label).width + 12, y - 1);

      if (secondLabel && secondVal !== undefined) {
        ctx.font = '11px sans-serif';
        ctx.fillStyle = '#334155';
        ctx.fillText(secondLabel, 470, y);

        ctx.strokeStyle = '#CBD5E1';
        ctx.beginPath();
        ctx.moveTo(470 + ctx.measureText(secondLabel).width + 5, y + 2);
        ctx.lineTo(850, y + 2);
        ctx.stroke();

        ctx.font = 'italic bold 14px cursive, sans-serif';
        ctx.fillStyle = '#1E3A8A';
        ctx.fillText(secondVal, 470 + ctx.measureText(secondLabel).width + 12, y - 1);
      }
      ctx.setLineDash([]);
    };

    // Lines
    drawHandwrittenRow('Name:', 'Diwakar Ray', 190, 'Student Phone No.', '9140536862');
    drawHandwrittenRow("Father's Name:", 'Mukund Lal Kushwaha', 220, "Father's Phone No.", '9956880842');
    drawHandwrittenRow('Address:', 'Ghazipur (U.P)', 250);

    // Room Type / College / Course / Year
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('Room Type: ................... College: ..................... Course: .............. Year: ...........', 45, 280);
    ctx.font = 'italic bold 13px cursive, sans-serif';
    ctx.fillStyle = '#1E3A8A';
    ctx.fillText('3 & 6 beds A.C.', 120, 278);
    ctx.fillText('Bennett', 290, 278);
    ctx.fillText('B.Tech', 445, 278);
    ctx.fillText('1st', 560, 278);

    // Fee lines
    drawHandwrittenRow('Total Hostel Fee:', '2,05,000/-', 315, 'Amount Received:', '10,000/-');
    drawHandwrittenRow('Rupees (In words):', 'Ten thousand Rupees Only', 350);

    // Balance and Next Inst
    drawHandwrittenRow('Balance Amount:', '1,95,000/-', 385, 'Next Inst. Amount:', '60% Shifting');
    drawHandwrittenRow('Payment Ref.:', '30054851268', 420, 'Cash/Cheque/Payorder/Online:', 'PhonePe');
    drawHandwrittenRow('Bank Name:', 'IDFC', 455, 'Payment Date:', '11/08/26');

    // Bottom Footer Banner: "On Behalf of Next 2 Door Living Limited"
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(200, 480, 500, 24);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('On Behalf of Next 2 Door Living Limited', 450, 496);

    // Signature stamp area
    ctx.textAlign = 'right';
    ctx.font = 'italic bold 14px cursive, sans-serif';
    ctx.fillStyle = '#0F172A';
    ctx.fillText('Authorised Signatory', 830, 520);

    return canvas.toDataURL('image/jpeg', 0.95);
  }

  if (sampleId === 'sample-challan-01') {
    canvas.width = 800;
    canvas.height = 1100;
    ctx.fillStyle = '#FCFAF7';
    ctx.fillRect(0, 0, 800, 1100);

    ctx.strokeStyle = '#2D3748';
    ctx.lineWidth = 3;
    ctx.strokeRect(24, 24, 752, 1052);

    ctx.fillStyle = '#1A365D';
    ctx.fillRect(32, 32, 736, 110);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAGORE BLOCK A HOSTEL & RESIDENCE', 400, 70);

    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText('Affiliated with National Institute of Technology Campus', 400, 95);

    ctx.fillStyle = '#2B6CB0';
    ctx.beginPath();
    ctx.roundRect(260, 155, 280, 32, 4);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('STUDENT FEE & ADMISSION RECEIPT', 400, 176);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#EDF2F7';
    ctx.fillRect(50, 205, 700, 48);
    ctx.strokeStyle = '#CBD5E0';
    ctx.strokeRect(50, 205, 700, 48);

    ctx.fillStyle = '#2D3748';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('Receipt No:', 65, 234);
    ctx.font = '13px monospace';
    ctx.fillStyle = '#C53030';
    ctx.fillText('REC/2026/0942', 150, 234);

    return canvas.toDataURL('image/png');
  }

  // Thermal & Admission Fallbacks
  canvas.width = 600;
  canvas.height = 700;
  ctx.fillStyle = '#F8F9FA';
  ctx.fillRect(0, 0, 600, 700);
  ctx.strokeStyle = '#CBD5E1';
  ctx.strokeRect(20, 20, 560, 660);
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HOSTEL FEE RECEIPT', 300, 80);
  return canvas.toDataURL('image/png');
}
