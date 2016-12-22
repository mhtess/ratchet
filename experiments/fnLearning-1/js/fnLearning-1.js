var functionsToLearn = {
  "y=1-x": function(x){return 1 - x},
  "y=x" : function(x){ return x},
  "y=sin(x)": function(x){ return Math.sin(x*Math.PI)}
};

var makeDataPoint = function(fn){
  var x = Math.random();
  var y = fn(x);
  return {x, y}
};

var color ="#316C0B";

var bugProps = {
  "tar1":true,
  "tar2":false,
  "prop1":0.3,
  "prop2":0.1,
  "col1":{"mean":"#316C0B"},
  "col2":{"mean":"#316C0B"},
  "col3":{"mean":"#316C0B"},
  "col4":{"mean":"#316C0B"},
  "col5":{"mean":"#316C0B"},
  "var":0.1
}

var treeProps =  {
  "tar1":false,
  "tar2":false,
  "prop1":0.02,
  "prop2":1,
  "col1":{"mean":color},
  "col2":{"mean":color},
  "col3":{"mean":color}
}

function make_slides(f) {
  var slides = {};

  slides.i0 = slide({
     name : "i0",
     start: function() {
       $("#timeMinutes").html(Math.round(
       (exp.training_stims.length + exp.test_stims.length) / 6))
      exp.startT = Date.now();
     }
  });

  slides.instructions = slide({
    name : "instructions",
    start: function() {
      $(".trainingTrials").html(exp.training_stims.length);
      $(".testTrials").html(exp.test_stims.length);
    },
    button : function() {
      exp.go(); //use exp.go() if and only if there is no "present" data.
    }
  });

  slides.intermediate_instructions = slide({
    name : "intermediate_instructions",
    start: function() {
      $(".testTrials").html(exp.test_stims.length);
    },
    button : function() {
      exp.go();
    }
  });


  slides.fn_learning_train = slide({
    name : "fn_learning_train",
    present : _.shuffle(exp.training_stims),
    present_handle : function(stim) {
      $(".err").hide();
      $(".adjust").hide();

      this.stim = stim;
      // might need to change the id tags to classes

      $(".vertical_question").html("Different sized bugs live at different heights on the tree.<br> For this bug on the left, how high on the tree does it live?");
      $("#sliders_train").empty();

      $("#sliders_train").append("<td><svg id='svg_bug_train'></svg></td><td class='blank'></td>");
      $("#sliders_train").append("<td><svg id='svg_tree_train'></svg></td>");
      $("#sliders_train").append('<td class="slider_endpoint_labels"> \
                    <div class="top">top   </div> \
                    <div class="bottom">bottom</div>\
                </td>');
      $("#sliders_train").append("<td id='slider_col_train'><div id='vslider0_train' class='vertical_slider'>|</div></td>");
      $("#sliders_train").append("<td id='slider_col1_train'><div id='vslider1_train' class='vertical_slider'>|</div></td>");
      $("#slider_col1_train").hide();
      var scale = 1;

      // var color = "#800000"
      Ecosystem.draw("bug", bugProps, "svg_bug_train", this.stim.x)

      Ecosystem.draw("tree", treeProps, "svg_tree_train", 2)

      this.init_sliders();
      exp.sliderPost = [];

      var label = "#vslider1_train";

      $(label+ ' .ui-slider-handle').show();
      $(label).slider({value:this.stim.y});
      $(label).css({"background":"#99D6EB"});
      $(label + ' .ui-slider-handle').css({
        "background":"#667D94",
        "border-color": "#001F29"
      })
      $(label).unbind("mousedown");
      exp.sliderPost = [];

    },
    button : function() {
      // LOGIC: touched slider ?
      // show other slider with correct answer
      // make participant adjust their slider to match
      if (exp.sliderPost.length == 0) {
        $(".err").show();
      } else if (!$("#slider_col1_train").is(":visible")){
        $("#slider_col1_train").show();
        $(".adjust").show();
        $(".err").hide();
      } else if (
        (exp.sliderPost[0] < this.stim.y - 0.04) ||
        (exp.sliderPost[0] > this.stim.y + 0.04)
      ) {
        $(".err").hide();
        $(".adjust").show();
      } else {
        this.log_responses();
        _stream.apply(this);
      }
    },
    init_sliders : function() {
      utils.make_slider("#vslider0_train", this.make_slider_callback(), "vertical");
      utils.make_slider("#vslider1_train", this.make_slider_callback(), "vertical");
    },
    make_slider_callback : function() {
      return function(event, ui) {
        exp.sliderPost[0] = ui.value;
      };
    },
    log_responses : function() {
      exp.data_trials.push({
        "trial_type" : "fnLearning_training",
        "input" : this.stim.x,
        "targetFn" : exp.targetFn,
        "true_output" : this.stim.y,
        "response" : exp.sliderPost[0]
      });
    },
  });

  slides.fn_learning_test = slide({
    name : "fn_learning_test",
    present : _.shuffle(exp.test_stims),
    present_handle : function(stim) {
      $(".err").hide();
      this.stim = stim;

      $(".vertical_question").html("Different sized bugs live on different parts of the tree.<br> For a bug this size, how high on the tree does it live?");
      $(".sliders").empty();



      $(".sliders").append("<td><svg id='svg_bug'></svg></td><td id='blank'></td>");
      $(".sliders").append("<td><svg id='svg_tree'></svg></td>");
      $(".sliders").append('<td class="slider_endpoint_labels"> \
                    <div class="top">top   </div> \
                    <div class="bottom">bottom</div>\
                </td>');
      $(".sliders").append("<td id='slider_col'><div id='vslider0' class='vertical_slider'>|</div></td>");
      var scale = 1;

      // var color = "#800000"
      Ecosystem.draw("bug",bugProps, "svg_bug", stim.x)
      Ecosystem.draw("tree",treeProps, "svg_tree", 2 )

      this.init_sliders();
      exp.sliderPost = [];
    },
    button : function() {
      if (exp.sliderPost.length == 0) {
        $(".err").show();
      } else {
        this.log_responses();
        _stream.apply(this);
      }
    },
    init_sliders : function() {
      utils.make_slider("#vslider0", this.make_slider_callback(), "vertical");
    },
    make_slider_callback : function() {
      return function(event, ui) {
        // $("#svg_bug").empty();
        // Ecosystem.draw("bug",bugProps, "svg_bug", ui.value)
        exp.sliderPost[0] = ui.value;
      };
    },
    log_responses : function() {
      exp.data_trials.push({
        "trial_type" : "fnLearning",
        "input" : this.stim.x,
        "targetFn" : exp.targetFn,
        "true_output" : this.stim.y,
        "response" : exp.sliderPost[0]
      });
    },
  });

  slides.subj_info =  slide({
    name : "subj_info",
    submit : function(e){
      //if (e.preventDefault) e.preventDefault(); // I don't know what this means.
      exp.subj_data = {
        language : $("#language").val(),
        enjoyment : $("#enjoyment").val(),
        asses : $('input[name="assess"]:checked').val(),
        age : $("#age").val(),
        gender : $("#gender").val(),
        education : $("#education").val(),
        comments : $("#comments").val(),
        targetFn : exp.targetFn,
      };
      exp.go(); //use exp.go() if and only if there is no "present" data.
    }
  });

  slides.thanks = slide({
    name : "thanks",
    start : function() {
      exp.data= {
          "trials" : exp.data_trials,
          "catch_trials" : exp.catch_trials,
          "system" : exp.system,
          "targetFn" : exp.targetFn,
          "subject_information" : exp.subj_data,
          "time_in_minutes" : (Date.now() - exp.startT)/60000
      };
      setTimeout(function() {turk.submit(exp.data);}, 1000);
    }
  });

  return slides;
}

/// init ///
function init() {
  exp.nTrainingTrials = 3;
  exp.nTestTrials = 2;

  exp.trials = [];
  exp.catch_trials = [];

  // exp.targetFn = _.sample(["y=1-x", "y=x", "y=sin(x)"])
  exp.targetFn = "y=1-x";

  // n random selected x-values

  // this is effectively repeat randomly drawing x,y pairs consistent with the function
  exp.training_stims = _.range(0, exp.nTrainingTrials).map(
    function(x){ return makeDataPoint(functionsToLearn[exp.targetFn]) }
  )
  exp.test_stims = _.range(0, exp.nTestTrials).map(
    function(x){
       return makeDataPoint(functionsToLearn[exp.targetFn])
    }
  )

  // could also do n equally spaced x-values
  // that is more like pedagogical sampling

  exp.system = {
      Browser : BrowserDetect.browser,
      OS : BrowserDetect.OS,
      screenH: screen.height,
      screenUH: exp.height,
      screenW: screen.width,
      screenUW: exp.width
    };

  //blocks of the experiment:
  exp.structure=[
    "i0",
    "instructions",
    "fn_learning_train",
    "intermediate_instructions",
    "fn_learning_test",
    "subj_info",
    "thanks"
  ];

  exp.data_trials = [];
  //make corresponding slides:
  exp.slides = make_slides(exp);

  exp.nQs = utils.get_exp_length(); //this does not work if there are stacks of stims (but does work for an experiment with this structure)
                    //relies on structure and slides being defined

  $('.slide').hide(); //hide everything

  //make sure turkers have accepted HIT (or you're not in mturk)
  $("#start_button").click(function() {
    if (turk.previewMode) {
      $("#mustaccept").show();
    } else {
      $("#start_button").click(function() {$("#mustaccept").show();});
      exp.go();
    }
  });

  exp.go(); //show first slide
}
