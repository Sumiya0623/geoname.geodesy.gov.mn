
export const ServiceGuide = {
  tour: 'service',
  steps: [
    {
      id: 'step-1',
      tour: 'service',
      icon: <>👋</>,
      title: 'Цэг тэмдэгтийн жагсаалт',
      content: (
        <p>
          Энэ хуудсанд та цэг тэмдэгтийн жагсаалттай ажиллах боломжтой.
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
      tour: 'service',
      icon: <>📝</>,
      title: 'Цэг тэмдэгтийн жагсаалт',
      content: (
        <p>
          Системд бүртгэлтэй цэг тэмдэгтүүдийн жагсаалт.
        </p>
      ),
      selector: '#service-table',
      side: 'bottom',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-5',
      tour: 'service',
      icon: <>✏️</>,
      title: 'Дэлгэрэнгүй',
      content: (
        <p>
          Энд дарж цэг тэмдэгтийн тухай дэлгэрэнгүй мэдээллийг харах боломжтой.
        </p>
      ),
      selector: '#service-detail-1',
      side: 'right',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-5',
      tour: 'service',
      icon: <>✏️</>,
      title: 'Хэмжилтүүд',
      content: (
        <p>
          Хэрэв тухайн цэгт давхар хэмжилтүүд бүртгэгдсэн бол энд дарж харах боломжтой.
        </p>
      ),
      selector: '#service-measure-1',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-5',
      tour: 'service',
      icon: <>✏️</>,
      title: 'Цэг тэмдэгт устгах',
      content: (
        <p>
          Энд дарснаар тухайн цэгийг мөн устгах боломжтой.
        </p>
      ),
      selector: '#service-delete-1',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
      perm: 'delete',
    },
  ],
}
