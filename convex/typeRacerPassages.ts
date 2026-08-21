export type TypeRacerPassage = {
  id: string;
  kind: 'phrase' | 'sentence' | 'paragraph';
  title: string;
  author: string;
  text: string;
};

/**
 * Long excerpts from well-known fiction in the US public domain. Keeping the
 * race corpus local makes each start deterministic and avoids blocking a room
 * on a third-party request. Punctuation is normalized to plain keyboard
 * characters so every racer can type the same text without smart-quote or
 * em-dash input differences.
 */
export const TYPE_RACER_PASSAGES = [
  {
    id: 'pride-and-prejudice-truth',
    kind: 'paragraph',
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    text: 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered as the rightful property of some one or other of their daughters.',
  },
  {
    id: 'pride-and-prejudice-bingley',
    kind: 'sentence',
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    text: 'Mr. Bennet was among the earliest of those who waited on Mr. Bingley. He had always intended to visit him, though to the last always assuring his wife that he should not go.',
  },
  {
    id: 'alice-bank',
    kind: 'paragraph',
    title: "Alice's Adventures in Wonderland",
    author: 'Lewis Carroll',
    text: 'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, and what is the use of a book, thought Alice, without pictures or conversations?',
  },
  {
    id: 'alice-white-rabbit',
    kind: 'sentence',
    title: "Alice's Adventures in Wonderland",
    author: 'Lewis Carroll',
    text: 'There was nothing so very remarkable in that; nor did Alice think it so very much out of the way to hear the Rabbit say to itself, Oh dear! Oh dear! I shall be late!',
  },
  {
    id: 'two-cities-times',
    kind: 'paragraph',
    title: 'A Tale of Two Cities',
    author: 'Charles Dickens',
    text: 'It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of Light, it was the season of Darkness, it was the spring of hope, it was the winter of despair.',
  },
  {
    id: 'great-expectations-name',
    kind: 'paragraph',
    title: 'Great Expectations',
    author: 'Charles Dickens',
    text: "My father's family name being Pirrip, and my Christian name Philip, my infant tongue could make of both names nothing longer or more explicit than Pip. So, I called myself Pip, and came to be called Pip.",
  },
  {
    id: 'christmas-carol-marley',
    kind: 'paragraph',
    title: 'A Christmas Carol',
    author: 'Charles Dickens',
    text: "Marley was dead: to begin with. There is no doubt whatever about that. The register of his burial was signed by the clergyman, the clerk, the undertaker, and the chief mourner. Scrooge signed it, and Scrooge's name was good upon Change for anything he chose to put his hand to.",
  },
  {
    id: 'david-copperfield-hero',
    kind: 'sentence',
    title: 'David Copperfield',
    author: 'Charles Dickens',
    text: "Whether I shall turn out to be the hero of my own life, or whether that station will be held by anybody else, these pages must show. To begin my life with the beginning of my life, I record that I was born on a Friday, at twelve o'clock at night.",
  },
  {
    id: 'oliver-twist-workhouse',
    kind: 'sentence',
    title: 'Oliver Twist',
    author: 'Charles Dickens',
    text: 'Among other public buildings in a certain town, there is one anciently common to most towns, great or small: to wit, a workhouse; and in this workhouse was born the item of mortality whose name is prefixed to the head of this chapter.',
  },
  {
    id: 'moby-dick-ishmael',
    kind: 'phrase',
    title: 'Moby-Dick',
    author: 'Herman Melville',
    text: 'Call me Ishmael. Some years ago - never mind how long precisely - having little or no money in my purse, I thought I would sail about a little and see the watery part of the world.',
  },
  {
    id: 'moby-dick-water',
    kind: 'paragraph',
    title: 'Moby-Dick',
    author: 'Herman Melville',
    text: 'Whenever I find myself growing grim about the mouth; whenever it is a damp, drizzly November in my soul; whenever I find myself involuntarily pausing before coffin warehouses, then, I account it high time to get to sea as soon as I can.',
  },
  {
    id: 'peter-pan-grow-up',
    kind: 'sentence',
    title: 'Peter Pan',
    author: 'J. M. Barrie',
    text: 'All children, except one, grow up. They soon know that they will grow up, and the way Wendy knew was this: one day when she was two years old she was playing in a garden, and she plucked another flower and ran with it to her mother.',
  },
  {
    id: 'wizard-of-oz-prairies',
    kind: 'paragraph',
    title: 'The Wonderful Wizard of Oz',
    author: 'L. Frank Baum',
    text: "Dorothy lived in the midst of the great Kansas prairies, with Uncle Henry, who was a farmer, and Aunt Em, who was the farmer's wife. Their house was small, for the lumber to build it had to be carried by wagon many miles.",
  },
  {
    id: 'wizard-of-oz-cyclone',
    kind: 'sentence',
    title: 'The Wonderful Wizard of Oz',
    author: 'L. Frank Baum',
    text: 'When Dorothy stood in the doorway and looked around, she could see nothing but the great gray prairie on every side. Not a tree nor a house broke the broad sweep of flat country that reached to the edge of the sky.',
  },
  {
    id: 'frankenstein-night',
    kind: 'paragraph',
    title: 'Frankenstein',
    author: 'Mary Shelley',
    text: 'It was on a dreary night of November that I beheld the accomplishment of my toils. With an anxiety that almost amounted to agony, I collected the instruments of life around me, that I might infuse a spark of being into the lifeless thing that lay at my feet.',
  },
  {
    id: 'frankenstein-mountains',
    kind: 'paragraph',
    title: 'Frankenstein',
    author: 'Mary Shelley',
    text: 'The immense mountains and precipices that overhung me on every side, the sound of the river raging among the rocks, and the dashing of the waterfalls around, spoke of a power mighty as Omnipotence, and I ceased to fear or to bend before any being less almighty than that which had created and ruled the elements.',
  },
  {
    id: 'secret-garden-mary',
    kind: 'paragraph',
    title: 'The Secret Garden',
    author: 'Frances Hodgson Burnett',
    text: 'When Mary Lennox was sent to Misselthwaite Manor to live with her uncle everybody said she was the most disagreeable-looking child ever seen. It was true, too. She had a little thin face and a little thin body, thin light hair and a sour expression.',
  },
  {
    id: 'wind-in-willows-mole',
    kind: 'paragraph',
    title: 'The Wind in the Willows',
    author: 'Kenneth Grahame',
    text: 'The Mole had been working very hard all the morning, spring-cleaning his little home. First with brooms, then with dusters; then on ladders and steps and chairs, with a brush and a pail of whitewash; till he had dust in his throat and eyes, and splashes of whitewash all over his black fur.',
  },
  {
    id: 'time-machine-matter',
    kind: 'sentence',
    title: 'The Time Machine',
    author: 'H. G. Wells',
    text: 'The Time Traveller, for so it will be convenient to speak of him, was expounding a recondite matter to us. His gray eyes shone and twinkled, and his usually pale face was flushed and animated.',
  },
  {
    id: 'time-machine-dimensions',
    kind: 'phrase',
    title: 'The Time Machine',
    author: 'H. G. Wells',
    text: 'There are really four dimensions, three which we call the three planes of Space, and a fourth, Time. There is, however, a tendency to draw an unreal distinction between the former three dimensions and the latter.',
  },
  {
    id: 'jane-eyre-walk',
    kind: 'paragraph',
    title: 'Jane Eyre',
    author: 'Charlotte Bronte',
    text: 'There was no possibility of taking a walk that day. We had been wandering, indeed, in the leafless shrubbery an hour in the morning; but since dinner the cold winter wind had brought with it clouds so sombre, and a rain so penetrating, that further outdoor exercise was now out of the question.',
  },
  {
    id: 'little-women-christmas',
    kind: 'sentence',
    title: 'Little Women',
    author: 'Louisa May Alcott',
    text: "Christmas won't be Christmas without any presents, grumbled Jo, lying on the rug. It is so dreadful to be poor, sighed Meg, looking down at her old dress. I don't think it's fair for some girls to have plenty of pretty things, and other girls nothing at all, added little Amy.",
  },
  {
    id: 'tom-sawyer-whitewash',
    kind: 'paragraph',
    title: 'The Adventures of Tom Sawyer',
    author: 'Mark Twain',
    text: 'Saturday morning was come, and all the summer world was bright and fresh, and brimming with life. There was a song in every heart; and if the heart was young the music issued at the lips. There was cheer in every face and a spring in every step.',
  },
  {
    id: 'dorian-gray-studio',
    kind: 'paragraph',
    title: 'The Picture of Dorian Gray',
    author: 'Oscar Wilde',
    text: 'The studio was filled with the rich odour of roses, and when the light summer wind stirred amidst the trees of the garden, there came through the open door the heavy scent of the lilac, or the more delicate perfume of the pink-flowering thorn.',
  },
  {
    id: 'dorian-gray-influence',
    kind: 'phrase',
    title: 'The Picture of Dorian Gray',
    author: 'Oscar Wilde',
    text: "There is no such thing as a good influence, Mr. Gray. All influence is immoral - immoral from the scientific point of view - because to influence a person is to give him one's own soul.",
  },
  {
    id: 'war-of-worlds-watched',
    kind: 'paragraph',
    title: 'The War of the Worlds',
    author: 'H. G. Wells',
    text: "No one would have believed in the last years of the nineteenth century that this world was being watched keenly and closely by intelligences greater than man's and yet as mortal as his own; that as men busied themselves about their various concerns they were scrutinised and studied.",
  },
  {
    id: 'war-of-worlds-minds',
    kind: 'sentence',
    title: 'The War of the Worlds',
    author: 'H. G. Wells',
    text: 'With infinite complacency men went to and fro over this globe about their little affairs, serene in their assurance of their empire over matter. Yet across the gulf of space, minds that are to our minds as ours are to those of the beasts regarded this earth with envious eyes.',
  },
  {
    id: 'treasure-island-map',
    kind: 'paragraph',
    title: 'Treasure Island',
    author: 'Robert Louis Stevenson',
    text: 'Squire Trelawney, Dr. Livesey, and the rest of these gentlemen having asked me to write down the whole particulars about Treasure Island, from the beginning to the end, keeping nothing back but the bearings of the island, and that only because there is still treasure not yet lifted, I take up my pen in the year of grace 17--.',
  },
  {
    id: 'dracula-bistritz',
    kind: 'paragraph',
    title: 'Dracula',
    author: 'Bram Stoker',
    text: '3 May. Bistritz. Left Munich at 8:35 P.M., on 1st May, arriving at Vienna early next morning; should have arrived at 6:46, but train was an hour late. Buda-Pesth seems a wonderful place, from the glimpse which I got of it from the train and the little I could walk through the streets.',
  },
  {
    id: 'sherlock-woman',
    kind: 'paragraph',
    title: 'A Scandal in Bohemia',
    author: 'Arthur Conan Doyle',
    text: 'To Sherlock Holmes she is always the woman. I have seldom heard him mention her under any other name. In his eyes she eclipses and predominates the whole of her sex. It was not that he felt any emotion akin to love for Irene Adler.',
  },
  {
    id: 'study-in-scarlet-watson',
    kind: 'sentence',
    title: 'A Study in Scarlet',
    author: 'Arthur Conan Doyle',
    text: 'In the year 1878 I took my degree of Doctor of Medicine of the University of London, and proceeded to Netley to go through the course prescribed for surgeons in the army. Having completed my studies there, I was duly attached to the Fifth Northumberland Fusiliers as Assistant Surgeon.',
  },
  {
    id: 'hound-breakfast',
    kind: 'phrase',
    title: 'The Hound of the Baskervilles',
    author: 'Arthur Conan Doyle',
    text: 'Mr. Sherlock Holmes, who was usually very late in the mornings, save upon those not infrequent occasions when he was up all night, was seated at the breakfast table.',
  },
  {
    id: 'black-beauty-meadow',
    kind: 'paragraph',
    title: 'Black Beauty',
    author: 'Anna Sewell',
    text: "The first place that I can well remember was a large pleasant meadow with a pond of clear water in it. Some shady trees leaned over it, and rushes and water-lilies grew at the deep end. Over the hedge on one side we looked into a plowed field, and on the other we looked over a gate at our master's house.",
  },
  {
    id: 'anne-green-gables-road',
    kind: 'paragraph',
    title: 'Anne of Green Gables',
    author: 'L. M. Montgomery',
    text: "Mrs. Rachel Lynde lived just where the Avonlea main road dipped down into a little hollow, fringed with alders and ladies' eardrops and traversed by a brook that had its source away back in the woods of the old Cuthbert place; it was reputed to be an intricate, headlong brook in its earlier course through those woods.",
  },
  {
    id: 'call-of-the-wild-buck',
    kind: 'sentence',
    title: 'The Call of the Wild',
    author: 'Jack London',
    text: 'Buck did not read the newspapers, or he would have known that trouble was brewing, not alone for himself, but for every tide-water dog, strong of muscle and with warm, long hair, from Puget Sound to San Diego.',
  },
  {
    id: 'white-fang-wild',
    kind: 'paragraph',
    title: 'White Fang',
    author: 'Jack London',
    text: 'Dark spruce forest frowned on either side the frozen waterway. The trees had been stripped by a recent wind of their white covering of frost, and they seemed to lean toward each other, black and ominous, in the fading light. A vast silence reigned over the land.',
  },
  {
    id: 'robinson-crusoe-born',
    kind: 'paragraph',
    title: 'Robinson Crusoe',
    author: 'Daniel Defoe',
    text: 'I was born in the year 1632, in the city of York, of a good family, though not of that country, my father being a foreigner of Bremen, who settled first at Hull. He got a good estate by merchandise, and leaving off his trade, lived afterward at York.',
  },
  {
    id: 'gullivers-travels-family',
    kind: 'paragraph',
    title: "Gulliver's Travels",
    author: 'Jonathan Swift',
    text: 'My father had a small estate in Nottinghamshire; I was the third of five sons. He sent me to Emanuel College in Cambridge at fourteen years old, where I resided three years, and applied myself close to my studies; but the charge of maintaining me was too great for a narrow fortune.',
  },
  {
    id: 'around-world-fogg',
    kind: 'sentence',
    title: 'Around the World in Eighty Days',
    author: 'Jules Verne',
    text: 'In the year 1872, the house at No. 7, Saville Row, Burlington Gardens, in which Sheridan died in 1814, was inhabited by Phileas Fogg, one of the most noticeable members of the Reform Club, though he seemed always to avoid attracting attention.',
  },
  {
    id: 'monte-cristo-pharaon',
    kind: 'paragraph',
    title: 'The Count of Monte Cristo',
    author: 'Alexandre Dumas',
    text: "On the 24th of February, 1815, the lookout at Notre-Dame de la Garde signalled the three-master, the Pharaon, from Smyrna, Trieste, and Naples. As usual, a pilot put off immediately, and rounding the Chateau d'If, got on board the vessel between Cape Morgion and Rion island.",
  },
  {
    id: 'three-musketeers-dartagnan',
    kind: 'sentence',
    title: 'The Three Musketeers',
    author: 'Alexandre Dumas',
    text: 'On the first Monday of the month of April, 1625, the market town of Meung, in which the author of The Romance of the Rose was born, appeared to be in as perfect a state of revolution as if the Huguenots had just made a second La Rochelle of it.',
  },
  {
    id: 'twenty-thousand-leagues-year',
    kind: 'paragraph',
    title: 'Twenty Thousand Leagues Under the Sea',
    author: 'Jules Verne',
    text: 'The year 1866 was signalised by a remarkable incident, a mysterious and puzzling phenomenon, which doubtless no one has yet forgotten. Not to mention rumours which agitated the maritime population and excited the public mind, even in the interior of continents, seafaring men were particularly excited.',
  },
  {
    id: 'invisible-man-stranger',
    kind: 'sentence',
    title: 'The Invisible Man',
    author: 'H. G. Wells',
    text: 'The stranger came early in February, one wintry day, through a biting wind and a driving snow, the last snowfall of the year, over the down, walking from Bramblehurst railway station and carrying a little black portmanteau in his thickly gloved hand.',
  },
  {
    id: 'island-doctor-moreau-statement',
    kind: 'phrase',
    title: 'The Island of Doctor Moreau',
    author: 'H. G. Wells',
    text: 'I do not propose to add anything to what has already been written concerning the loss of the Lady Vain. As everyone knows, she collided with a derelict when ten days out from Callao.',
  },
  {
    id: 'princess-of-mars-memory',
    kind: 'phrase',
    title: 'A Princess of Mars',
    author: 'Edgar Rice Burroughs',
    text: 'I am a very old man; how old I do not know. Possibly I am a hundred, possibly more; but I cannot tell because I have never aged as other men, nor do I remember any childhood.',
  },
  {
    id: 'tarzan-story',
    kind: 'phrase',
    title: 'Tarzan of the Apes',
    author: 'Edgar Rice Burroughs',
    text: 'I had this story from one who had no business to tell it to me, or to any other. I may credit the seductive influence of an old vintage upon the narrator for the beginning of it.',
  },
  {
    id: 'phantom-opera-ghost',
    kind: 'sentence',
    title: 'The Phantom of the Opera',
    author: 'Gaston Leroux',
    text: 'The Opera ghost really existed. He was not, as was long believed, a creature of the imagination of the artists, the superstition of the managers, or a product of the absurd and impressionable brains of the young ladies of the ballet.',
  },
  {
    id: 'sleepy-hollow-cove',
    kind: 'paragraph',
    title: 'The Legend of Sleepy Hollow',
    author: 'Washington Irving',
    text: 'In the bosom of one of those spacious coves which indent the eastern shore of the Hudson, at that broad expansion of the river called by the ancient Dutch navigators the Tappan Zee, and where they always prudently shortened sail and implored the protection of St. Nicholas when they crossed, there lies a small market town.',
  },
  {
    id: 'scarlet-letter-prison',
    kind: 'paragraph',
    title: 'The Scarlet Letter',
    author: 'Nathaniel Hawthorne',
    text: 'A throng of bearded men, in sad-coloured garments and gray steeple-crowned hats, intermixed with women, some wearing hoods and others bareheaded, was assembled in front of a wooden edifice, the door of which was heavily timbered with oak and studded with iron spikes.',
  },
  {
    id: 'seven-gables-house',
    kind: 'sentence',
    title: 'The House of the Seven Gables',
    author: 'Nathaniel Hawthorne',
    text: 'Halfway down a by-street of one of our New England towns stands a rusty wooden house, with seven acutely peaked gables, facing toward various points of the compass, and a huge clustered chimney in the midst.',
  },
  {
    id: 'wuthering-heights-landlord',
    kind: 'phrase',
    title: 'Wuthering Heights',
    author: 'Emily Bronte',
    text: 'I have just returned from a visit to my landlord - the solitary neighbour that I shall be troubled with. This is certainly a beautiful country! In all England, I do not believe that I could have fixed on a situation so completely removed from the stir of society.',
  },
  {
    id: 'middlemarch-miss-brooke',
    kind: 'sentence',
    title: 'Middlemarch',
    author: 'George Eliot',
    text: 'Miss Brooke had that kind of beauty which seems to be thrown into relief by poor dress. Her hand and wrist were so finely formed that she could wear sleeves not less bare of style than those in which the Blessed Virgin appeared to Italian painters.',
  },
  {
    id: 'emma-woodhouse',
    kind: 'phrase',
    title: 'Emma',
    author: 'Jane Austen',
    text: 'Emma Woodhouse, handsome, clever, and rich, with a comfortable home and happy disposition, seemed to unite some of the best blessings of existence; and had lived nearly twenty-one years in the world with very little to distress or vex her.',
  },
  {
    id: 'sense-and-sensibility-dashwood',
    kind: 'sentence',
    title: 'Sense and Sensibility',
    author: 'Jane Austen',
    text: 'The family of Dashwood had long been settled in Sussex. Their estate was large, and their residence was at Norland Park, in the centre of their property, where, for many generations, they had lived in so respectable a manner as to engage the general good opinion of their surrounding acquaintance.',
  },
  {
    id: 'northanger-abbey-heroine',
    kind: 'sentence',
    title: 'Northanger Abbey',
    author: 'Jane Austen',
    text: 'No one who had ever seen Catherine Morland in her infancy would have supposed her born to be an heroine. Her situation in life, the character of her father and mother, her own person and disposition, were all equally against her.',
  },
  {
    id: 'persuasion-sir-walter',
    kind: 'phrase',
    title: 'Persuasion',
    author: 'Jane Austen',
    text: 'Sir Walter Elliot, of Kellynch Hall, in Somersetshire, was a man who, for his own amusement, never took up any book but the Baronetage; there he found occupation for an idle hour, and consolation in a distressed one.',
  },
  {
    id: 'mansfield-park-ward',
    kind: 'sentence',
    title: 'Mansfield Park',
    author: 'Jane Austen',
    text: "About thirty years ago Miss Maria Ward, of Huntingdon, with only seven thousand pounds, had the good luck to captivate Sir Thomas Bertram, of Mansfield Park, in the county of Northampton, and to be thereby raised to the rank of a baronet's lady.",
  },
  {
    id: 'silas-marner-weavers',
    kind: 'paragraph',
    title: 'Silas Marner',
    author: 'George Eliot',
    text: 'In the days when the spinning-wheels hummed busily in the farmhouses, and even great ladies, clothed in silk and thread-lace, had their toy spinning-wheels of polished oak, there might be seen in districts far away among the lanes certain pallid undersized men, who looked like the remnants of a disinherited race.',
  },
  {
    id: 'jungle-book-council-rock',
    kind: 'sentence',
    title: 'The Jungle Book',
    author: 'Rudyard Kipling',
    text: "It was seven o'clock of a very warm evening in the Seeonee hills when Father Wolf woke up from his day's rest, scratched himself, yawned, and spread out his paws one after the other to get rid of the sleepy feeling in their tips.",
  },
  {
    id: 'jekyll-hyde-utterson',
    kind: 'phrase',
    title: 'Strange Case of Dr Jekyll and Mr Hyde',
    author: 'Robert Louis Stevenson',
    text: 'Mr. Utterson the lawyer was a man of a rugged countenance that was never lighted by a smile; cold, scanty and embarrassed in discourse; backward in sentiment; lean, long, dusty, dreary, and yet somehow lovable.',
  },
  {
    id: 'heart-of-darkness-cruising-yawl',
    kind: 'sentence',
    title: 'Heart of Darkness',
    author: 'Joseph Conrad',
    text: 'The Nellie, a cruising yawl, swung to her anchor without a flutter of the sails, and was at rest. The flood had made, the wind was nearly calm, and being bound down the river, the only thing for it was to come to and wait for the turn of the tide.',
  },
] as const satisfies readonly TypeRacerPassage[];

export function chooseTypeRacerPassage(
  previousPassageId: string | null,
  random: () => number = Math.random
): TypeRacerPassage {
  const candidates =
    TYPE_RACER_PASSAGES.length > 1
      ? TYPE_RACER_PASSAGES.filter((passage) => passage.id !== previousPassageId)
      : TYPE_RACER_PASSAGES;
  const index = Math.min(candidates.length - 1, Math.floor(Math.max(0, random()) * candidates.length));
  const passage = candidates[index];
  if (passage === undefined) {
    throw new Error('The type racer passage bank is empty.');
  }
  return passage;
}
