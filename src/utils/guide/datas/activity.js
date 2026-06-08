
export const ActivityGuide = {
  tour: 'activity',
  steps: [
    {
      id: 'step-1',
      tour: 'activity',
      icon: <>👋</>,
      title: 'Ажлын нэр төрөл',
      content: (
        <p>
          Геодези, зураг зүйн салбарын ажлын нэр төрлийн мэдээллийг эндээс удирдах боломжтой.
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
      tour: 'activity',
      icon: <>📝</>,
      title: 'Төрлийн жагсаалт',
      content: (
        <p>
          Ажлын ерөнхий нэр төрөл болон тусгайлсан төрлүүдийн жагсаалтыг эндээс харах боломжтой.
        </p>
      ),
      selector: '#activity-list',
      side: 'bottom',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-3',
      tour: 'activity',
      icon: <>📝</>,
      title: 'Төрлийн жагсаалт',
      content: (
        <p>
          Дэд төрлийг энд дарж задлаж харах боломжтой.
        </p>
      ),
      selector: '#activity-exp-1',
      side: 'right',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-4',
      tour: 'activity',
      icon: <>📝</>,
      title: 'Төрөл үүсгэх',
      content: (
        <p>
          Энд дарснаар шинэ төрөл үүсгэх боломжтой.
        </p>
      ),
      selector: '#activity-create',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
      perm: 'create',
    },
    {
      id: 'step-5',
      tour: 'activity',
      icon: <>✏️</>,
      title: 'Төрөл засах',
      content: (
        <p>
          Энд дарснаар устгах, засварлах боломжтой.
        </p>
      ),
      selector: '#activity-edit-1',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
      perm: 'update',
    },
    {
      id: 'step-6',
      tour: 'activity',
      icon: <>✏️</>,
      title: 'Төрөл хуулах',
      content: (
        <p>
          Энд дарснаар хуулах боломжтой.
        </p>
      ),
      selector: '#activity-dup-1',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
      perm: 'copy',
    },
    {
      id: 'step-7',
      tour: 'activity',
      icon: <>✏️</>,
      title: 'Дэд төрөл нэмэх',
      content: (
        <p>
          Энд дарснаар дэд төрөл нэмэх боломжтой.
        </p>
      ),
      selector: '#activity-add-1',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
      perm: 'create',
    },
  ],
}
