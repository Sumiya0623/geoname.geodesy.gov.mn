
export const CountGuide = {
  tour: 'count',
  steps: [
    {
      id: 'step-1',
      tour: 'count',
      icon: <>👋</>,
      title: 'Дүгнэлт',
      content: (
        <p>
          Энэ хуудсанд та тооллогын мэдээллийг удирдах боломжтой.
        </p>
      ),
      side: 'top',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-5',
      tour: 'count',
      icon: <>✏️</>,
      title: 'Тооллого бүртгэх',
      content: (
        <p>
          Энд дарснаар тооллогын мэдээлэл бүртгэх боломжтой.
        </p>
      ),
      selector: '#count-add',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
      perm: 'create',
    },
    {
      id: 'step-2',
      tour: 'count',
      icon: <>📝</>,
      title: 'Тооллогын жагсаалт',
      content: (
        <p>
          Системд бүртгэлтэй тооллогын жагсаалт.
        </p>
      ),
      selector: '#count-table',
      side: 'bottom',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-5',
      tour: 'count',
      icon: <>✏️</>,
      title: 'Тооллогын явц',
      content: (
        <p>
          Энд тооллогын явц харагдана.
        </p>
      ),
      selector: '#count-status-1',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-5',
      tour: 'count',
      icon: <>✏️</>,
      title: 'Тооллогын явц',
      content: (
        <p>
          Энд дарж тооллогын зургуудийг харах боломжтой
        </p>
      ),
      selector: '#count-photos-1',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-5',
      tour: 'count',
      icon: <>✏️</>,
      title: 'Тооллогын дэлгэрэнгүй',
      content: (
        <p>
          Энд дарснаар тооллогын дэлгэрэнгүй мэдээлэл, засах, устгах боломжтой.
        </p>
      ),
      selector: '#count-update-1',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
      perm: 'update',
    },
  ],
}
