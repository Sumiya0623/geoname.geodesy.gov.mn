
export const StatisticGuide = {
  tour: 'statistic',
  steps: [
    {
      id: 'step-1',
      tour: 'statistic',
      icon: <>👋</>,
      title: 'Статистик хуудас',
      content: (
        <p>
          Системийн статистик мэдээлэл хүргэх хуудас.
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
      tour: 'statistic',
      icon: <>📝</>,
      title: 'Нийт статистик мэдээлэл',
      content: (
        <p>
          Дээрхи мэдээллүүдийг нийт болон он оноор шүүн харах боломжтой.
        </p>
      ),
      selector: '#stat-all',
      side: 'bottom',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-3',
      tour: 'statistic',
      icon: <>📝</>,
      title: 'Оны шүүлтүүр',
      content: (
        <p>
          Энд дарснаар оны шүүлтүүрийг сонгох боломжтой.
        </p>
      ),
      selector: '#stat-year',
      side: 'right',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
  ],
}
