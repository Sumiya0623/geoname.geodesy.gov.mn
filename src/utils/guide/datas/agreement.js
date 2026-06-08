
export const agreementGuide = {
  tour: 'agreement',
  steps: [
    {
      id: 'step-1',
      tour: 'agreement',
      icon: <>👋</>,
      title: 'Гэрээт ажлын жагсаалт',
      content: (
        <p>
          Энэ хуудсанд та гэрээт ажлуудыг удирдах боломжтой.
        </p>
      ),
      side: 'top',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-2',
      tour: 'agreement',
      icon: <>📝</>,
      title: 'Гэрээт ажлын жагсаалт',
      content: (
        <p>
          Захиалгат ажлын дэд системд бүртгэлтэй тухайн байгууллагын төслийн жагсаалт
        </p>
      ),
      selector: '#champaign-table',
      side: 'bottom',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-4',
      tour: 'agreement',
      icon: <>📝</>,
      title: 'Гэрээт ажил',
      content: (
        <p>
          Энд дарснаар гэрээт ажлын дэлгэрэнгүй мэдээлэл болон түүнд хамаарах хэмжилтүүд, акт зэргийг удирдах боломжтой.
        </p>
      ),
      selector: '#champaign-detail-1',
      side: 'bottom',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
      perm: 'detail',
    },
  ],
}
