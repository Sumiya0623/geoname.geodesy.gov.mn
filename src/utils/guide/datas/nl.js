
export const NlGuide = {
  tour: 'nl',
  steps: [
    {
      id: 'step-1',
      tour: 'nl',
      icon: <>👋</>,
      title: 'Машин сургалт',
      content: (
        <p>
          Системд ашиглагдаж буй Чатботын түүхийг эндээс удирдах боломжтой.
        </p>
      ),
      side: 'top',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-4',
      tour: 'nl',
      icon: <>📝</>,
      title: 'Машин сургалт',
      content: (
        <p>
          Энд дарснаар сургалт эхлүүлэх боломжтой.
        </p>
      ),
      selector: '#nl-create',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
      perm: 'create',
    },
    {
      id: 'step-2',
      tour: 'nl',
      icon: <>📝</>,
      title: 'Машин сургалт',
      content: (
        <p>
          Чатботтой харьцсан түүх энд харагдана.
        </p>
      ),
      selector: '#nl-table',
      side: 'bottom',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-5',
      tour: 'nl',
      icon: <>✏️</>,
      title: 'Үнэлгээ өгөх',
      content: (
        <p>
          Энд дарж тухайн чат хэр үр дүнтэй ажилласан бэ гэдгийг шийдэж болно.
        </p>
      ),
      selector: '#nl-rate-1',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
      perm: 'update',
    },
    {
      id: 'step-6',
      tour: 'nl',
      icon: <>✏️</>,
      title: 'Gold intent',
      content: (
        <p>
          Тухайн түүхийг Gold Intent болгон хувиргах мөн устгах боломжтой.
        </p>
      ),
      selector: '#nl-gold-1',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
      perm: 'update',
    },
  ],
}
