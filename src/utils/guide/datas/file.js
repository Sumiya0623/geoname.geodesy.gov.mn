
export const FileGuide = {
  tour: 'file',
  steps: [
    {
      id: 'step-1',
      tour: 'file',
      icon: <>👋</>,
      title: 'Файлын сан',
      content: (
        <p>
          Гэрээт ажил түүнд хамаарах болон таны бусад хандах эрхтэй файлуудын сан
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
      tour: 'file',
      icon: <>📝</>,
      title: 'Файлын жагсаалт',
      content: (
        <p>
          Таны харах эрхтэй файлуудын жагсаалт
        </p>
      ),
      selector: '#file-table',
      side: 'bottom',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-4',
      tour: 'file',
      icon: <>📝</>,
      title: 'Файлын дэлгэрэнгүй',
      content: (
        <p>
          Энд дарснаар файлын дэлгэрэнгүй мэдээлэл болон файлыг татах боломжтой.
        </p>
      ),
      selector: '#file-detail-1',
      side: 'right',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
      perm: 'detail',
    },
    {
      id: 'step-4',
      tour: 'file',
      icon: <>📝</>,
      title: 'Файлын тайлант үе шат',
      content: (
        <p>
          Энд дарснаар файлын хамаарах гэрээт ажил болон тухайн тайлант үе шатыг үзэх боломжтой.
        </p>
      ),
      selector: '#file-report-1',
      side: 'top',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
      perm: 'detail',
    },
  ],
}
